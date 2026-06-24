import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminCreateUser, adminDeleteUser } from "@/lib/admin-users.functions";

export type UserRole = "admin" | "gestor";
export type Region = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
export type UserStatus = "Ativo" | "Inativo";

export const REGIONS: Region[] = [
  "Norte",
  "Nordeste",
  "Centro-Oeste",
  "Sudeste",
  "Sul",
];

export const STATES_BY_REGION: Record<Region, string[]> = {
  Norte: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MT", "MS"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};

export const DEFAULT_PASSWORD = "Sebrae@2025";

// Super administrator e-mail — hidden from CRUD listings.
export const SUPER_ADMIN_EMAIL = "jusmar.chaves@providence.solutions";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  unit: string;
  region: Region;
  state: string | null;
  role: UserRole;
  status: UserStatus;
  isFirstAccess: boolean;
}

export interface UserInput {
  name: string;
  email: string;
  phone: string;
  unit: string;
  region: Region | "";
  state: string | null;
  role: UserRole;
  status: UserStatus;
}


// ---------- Users list (reactive cache) ----------

let usersCache: AuthUser[] = [];
let usersFetched = false;
const usersListeners = new Set<() => void>();

function notifyUsers() {
  for (const l of usersListeners) l();
}

async function fetchUsers(): Promise<AuthUser[]> {
  const [profilesRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  const profiles = profilesRes.data ?? [];
  const roleMap = new Map<string, UserRole>();
  for (const r of rolesRes.data ?? []) {
    roleMap.set(r.user_id, r.role as UserRole);
  }
  return profiles.map((p): AuthUser => ({
    id: p.id,
    email: p.email,
    name: p.name,
    phone: p.phone ?? "",
    unit: p.unity,
    region: p.region as Region,
    role: roleMap.get(p.id) ?? "gestor",
    status: "Ativo",
    isFirstAccess: p.is_first_access ?? false,
  }));
}

export async function refreshUsers() {
  usersCache = await fetchUsers();
  usersFetched = true;
  notifyUsers();
}

export function listUsers(): AuthUser[] {
  return usersCache;
}

export function useUsersList(): AuthUser[] {
  return useSyncExternalStore(
    (cb) => {
      usersListeners.add(cb);
      if (!usersFetched) void refreshUsers();
      return () => {
        usersListeners.delete(cb);
      };
    },
    () => usersCache,
    () => usersCache,
  );
}

// ---------- Mutations ----------

export async function createUser(
  input: UserInput,
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  try {
    const res = await adminCreateUser({
      data: {
        name: input.name,
        email: input.email.trim(),
        phone: input.phone,
        unit: input.unit,
        region: input.region,
        role: input.role,
        password: DEFAULT_PASSWORD,
      },
    });
    await refreshUsers();
    return {
      ok: true,
      user: {
        id: res.userId,
        email: input.email,
        name: input.name,
        phone: input.phone,
        unit: input.unit,
        region: input.region,
        role: input.role,
        status: "Ativo",
        isFirstAccess: true,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar usuário." };
  }
}

export async function updateUser(
  id: string,
  input: UserInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("profiles")
    .update({
      name: input.name,
      email: input.email,
      phone: input.phone,
      unity: input.unit,
      region: input.region,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  const { error: rErr } = await supabase.rpc("set_user_role", {
    _user_id: id,
    _role: input.role,
  });
  if (rErr) return { ok: false, error: rErr.message };
  await refreshUsers();
  return { ok: true };
}

export async function deleteUser(id: string): Promise<void> {
  // Removes the profile (cascade also handled by FK to auth.users when it cascades).
  await supabase.from("profiles").delete().eq("id", id);
  await refreshUsers();
}

// ---------- Auth context ----------

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>;
  signUp: (
    input: UserInput & { password: string },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  changePassword: (
    newPassword: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function hydrateUser(authUserId: string): Promise<AuthUser | null> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUserId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", authUserId),
  ]);
  if (!profile) return null;
  const role = ((roles?.[0]?.role as UserRole) ?? "gestor") as UserRole;
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phone: profile.phone ?? "",
    unit: profile.unity,
    region: profile.region as Region,
    role,
    status: "Ativo",
    isFirstAccess: profile.is_first_access ?? false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const uid = session.user.id;
        // Defer to avoid Supabase deadlock when calling APIs inside the callback
        setTimeout(async () => {
          const u = await hydrateUser(uid);
          setUser(u);
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login: AuthContextValue["login"] = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, error: error.message };
    if (!data.user) return { ok: false, error: "Falha no login." };
    const u = await hydrateUser(data.user.id);
    if (!u) return { ok: false, error: "Perfil não encontrado." };
    setUser(u);
    return { ok: true, user: u };
  }, []);

  const signUp: AuthContextValue["signUp"] = useCallback(async (input) => {
    const { error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          name: input.name,
          phone: input.phone,
          unity: input.unit,
          region: input.region,
        },
      },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const changePassword: AuthContextValue["changePassword"] = useCallback(
    async (newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message };
      if (user) {
        await supabase
          .from("profiles")
          .update({ is_first_access: false })
          .eq("id", user.id);
        setUser({ ...user, isFirstAccess: false });
      }
      return { ok: true };
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signUp, logout, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
