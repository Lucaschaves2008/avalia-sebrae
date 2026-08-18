import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { adminCreateUser, adminDeleteUser } from "@/lib/admin-users.functions";

// Falhas de rede (queda de conexão, bloqueio de proxy corporativo como o
// Zscaler) chegam do supabase-js com mensagens técnicas em inglês
// ("Failed to fetch"). Traduzimos para uma orientação útil ao usuário.
const NETWORK_ERROR_MESSAGE =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente. " +
  "Se o problema continuar, abra a página /diagnostico e envie o relatório à TI.";

function isNetworkError(error: { message?: string }): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  return /fetch|network|timeout|aborted|load failed/i.test(error.message ?? "");
}

export type UserRole = "admin" | "gestor";
export type Region = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
export type UserStatus = "Ativo" | "Inativo";

export const REGIONS: Region[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

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

import {
  loadCache,
  saveCache,
  isFresh,
  clearAllCaches,
  clearCache,
  parseCachedList,
  asString,
  asBoolean,
} from "./cache-persist";
const USERS_CACHE_KEY = "users";
const SESSION_USER_CACHE_KEY = "session-user";

// Normaliza um usuário vindo do localStorage para o formato atual — dados
// gravados por versões anteriores não podem chegar crus ao render.
function parseCachedUser(raw: Record<string, unknown>): AuthUser | null {
  const id = asString(raw.id);
  if (!id) return null;
  const region = asString(raw.region);
  const role = asString(raw.role);
  return {
    id,
    email: asString(raw.email),
    name: asString(raw.name),
    phone: asString(raw.phone),
    unit: asString(raw.unit),
    region: (REGIONS as string[]).includes(region) ? (region as Region) : "Sudeste",
    state: typeof raw.state === "string" ? raw.state : null,
    role: role === "admin" ? "admin" : "gestor",
    status: asString(raw.status) === "Inativo" ? "Inativo" : "Ativo",
    isFirstAccess: asBoolean(raw.isFirstAccess),
  };
}

let usersCache: AuthUser[] = [];
let usersFetched = false;
let usersSavedAt = 0;
let usersRefreshScheduled = false;
const usersListeners = new Set<() => void>();

const _persistedUsers = loadCache<AuthUser[]>(USERS_CACHE_KEY, (raw) =>
  parseCachedList(raw, parseCachedUser),
);
if (_persistedUsers) {
  usersCache = _persistedUsers.data;
  usersFetched = true;
  usersSavedAt = _persistedUsers.savedAt;
}

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
  return profiles
    .filter((p) => p.email !== SUPER_ADMIN_EMAIL)
    .map(
      (p): AuthUser => ({
        id: p.id,
        email: p.email,
        name: p.name,
        phone: p.phone ?? "",
        unit: p.unity,
        region: p.region as Region,
        state: (p as { state?: string | null }).state ?? null,
        role: roleMap.get(p.id) ?? "gestor",
        status: ((p as { status?: UserStatus }).status ?? "Ativo") as UserStatus,
        isFirstAccess: p.is_first_access ?? false,
      }),
    );
}

export async function refreshUsers() {
  usersCache = await fetchUsers();
  usersFetched = true;
  usersSavedAt = Date.now();
  saveCache(USERS_CACHE_KEY, usersCache);
  notifyUsers();
}

function requestUsersRefresh() {
  if (usersFetched && isFresh(usersSavedAt)) return;
  if (usersRefreshScheduled) return;
  usersRefreshScheduled = true;
  window.setTimeout(() => {
    usersRefreshScheduled = false;
    void refreshUsers();
  }, 0);
}


export function listUsers(): AuthUser[] {
  return usersCache;
}

export function useUsersList(): AuthUser[] {
  return useUsersListWhen(true);
}

export function useUsersListWhen(enabled: boolean): AuthUser[] {
  const [snapshot, setSnapshot] = useState(usersCache);

  useEffect(() => {
    const update = () => setSnapshot(usersCache);
    usersListeners.add(update);
    if (enabled) requestUsersRefresh();
    return () => {
      usersListeners.delete(update);
    };
  }, [enabled]);

  return snapshot;
}

// ---------- Mutations ----------

function normalizeRegion(input: UserInput): Region {
  if (!input.region) return "Sudeste";
  return input.region;
}

export async function createUser(
  input: UserInput,
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  try {
    const region = normalizeRegion(input);
    const res = await adminCreateUser({
      data: {
        name: input.name,
        email: input.email.trim(),
        phone: input.phone,
        unit: input.unit,
        region,
        state: input.state ?? null,
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
        region,
        state: input.state ?? null,
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
  const region = normalizeRegion(input);
  const { error } = await supabase
    .from("profiles")
    .update({
      name: input.name,
      email: input.email,
      phone: input.phone,
      unity: input.unit,
      region,
      state: input.state ?? null,
      status: input.status,
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

export async function deleteUser(
  id: string,
): Promise<{ ok: true; mode: "physical" | "logical" } | { ok: false; error: string }> {
  try {
    const res = await adminDeleteUser({ data: { userId: id } });
    await refreshUsers();
    return { ok: true, mode: res.mode };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao excluir usuário." };
  }
}

// ---------- Auth context ----------

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isHydrated: boolean;
  /**
   * Preenchido quando a sessão existe mas o perfil não pôde ser carregado
   * (falha de rede). Diferente de `user === null`, que significa "não há
   * ninguém logado" — as telas usam isso para não redirecionar ao login
   * durante uma instabilidade de conexão.
   */
  authError: string | null;
  /** Recarrega o perfil do usuário logado a partir do banco. */
  refresh: () => Promise<void>;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>;
  signUp: (
    input: UserInput & { password: string },
  ) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Carrega perfil + papel do usuário.
 *
 * Devolve `null` só quando o perfil realmente não existe. Falha de consulta
 * (rede fora, proxy bloqueando) LANÇA — antes as duas situações viravam
 * `null` e o app deslogava o usuário no meio do trabalho por um soluço de
 * rede, o que na rede do SEBRAE acontece com frequência.
 */
async function hydrateUser(authUserId: string): Promise<AuthUser | null> {
  const [profileRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUserId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", authUserId),
  ]);
  if (profileRes.error) throw new Error(profileRes.error.message);
  if (rolesRes.error) throw new Error(rolesRes.error.message);
  const { data: profile } = profileRes;
  const { data: roles } = rolesRes;
  if (!profile) return null;
  const role = ((roles?.[0]?.role as UserRole) ?? "gestor") as UserRole;
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phone: profile.phone ?? "",
    unit: profile.unity,
    region: profile.region as Region,
    state: (profile as { state?: string | null }).state ?? null,
    role,
    status: ((profile as { status?: UserStatus }).status ?? "Ativo") as UserStatus,
    isFirstAccess: profile.is_first_access ?? false,
  };
}

// Perfil do usuário logado, em memória do módulo.
//
// O <AuthProvider> vive no root e não desmonta entre navegações, mas manter
// o valor aqui (e não só no state) permite dois ganhos: o primeiro render
// após um F5 já sai com o usuário do cache persistido — sem tela de
// "Carregando..." — e hidratações concorrentes do mesmo id são deduplicadas.
let sessionUser: AuthUser | null = null;
let sessionUserHydratedFor: string | null = null;
let inFlightHydration: { userId: string; promise: Promise<AuthUser | null> } | null = null;

// O perfil persistido serve só para o primeiro paint; ele é sempre
// revalidado contra o banco em seguida. Não é credencial nem autorização:
// toda decisão de permissão vale no servidor (RLS + checagem de papel nas
// server functions), então um perfil adulterado no navegador não concede
// nenhum acesso real.
const _persistedSessionUser = loadCache<AuthUser>(SESSION_USER_CACHE_KEY, (raw) =>
  raw && typeof raw === "object" && !Array.isArray(raw)
    ? parseCachedUser(raw as Record<string, unknown>)
    : null,
);
if (_persistedSessionUser) {
  sessionUser = _persistedSessionUser.data;
  sessionUserHydratedFor = _persistedSessionUser.data.id;
}

function setSessionUser(next: AuthUser | null) {
  sessionUser = next;
  sessionUserHydratedFor = next?.id ?? null;
  if (next) saveCache(SESSION_USER_CACHE_KEY, next);
  else clearCache(SESSION_USER_CACHE_KEY);
}

/** Hidrata o perfil deduplicando chamadas concorrentes para o mesmo usuário. */
function hydrateOnce(userId: string): Promise<AuthUser | null> {
  if (inFlightHydration?.userId === userId) return inFlightHydration.promise;
  const promise = hydrateUser(userId).finally(() => {
    if (inFlightHydration?.userId === userId) inFlightHydration = null;
  });
  inFlightHydration = { userId, promise };
  return promise;
}

// useLayoutEffect roda antes do paint no navegador (evita piscar) e não
// existe no servidor — lá cai em useEffect, que nunca chega a executar.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function AuthProvider({ children }: { children: ReactNode }) {
  // O primeiro render precisa ser IDÊNTICO ao HTML vindo do servidor, que
  // não enxerga localStorage — por isso começa vazio, mesmo já tendo o
  // perfil em mãos. Semear o estado aqui quebrava a hidratação do React
  // (erro #418) e forçava um re-render completo da página.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Aplica o perfil já conhecido logo após a hidratação e antes do paint:
  // na prática o usuário não vê a tela de "Carregando...".
  useIsomorphicLayoutEffect(() => {
    if (sessionUser) {
      setUser(sessionUser);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrateSessionUser(userId: string | null | undefined) {
      if (!mounted) return;
      if (!userId) {
        setSessionUser(null);
        setUser(null);
        setAuthError(null);
        setLoading(false);
        return;
      }

      // Já temos este usuário hidratado (outra aba, navegação, evento
      // repetido de auth): usa o que está em memória e revalida em segundo
      // plano, sem piscar a tela.
      const alreadyHydrated = sessionUserHydratedFor === userId && sessionUser !== null;
      if (alreadyHydrated) {
        setUser(sessionUser);
        setLoading(false);
      }

      try {
        const u = await hydrateOnce(userId);
        if (!mounted) return;
        // `hydrateUser` devolve null quando o perfil não existe — aí o
        // usuário é realmente deslogado.
        setSessionUser(u);
        setUser(u);
        setAuthError(null);
      } catch (error) {
        // Falha de rede (queda de conexão, bloqueio de proxy corporativo).
        // Deslogar aqui jogaria o usuário para o login por um soluço de
        // rede; preservamos o perfil já conhecido e seguimos.
        console.error("[auth] falha ao hidratar perfil:", error);
        if (!mounted) return;
        if (!alreadyHydrated) setUser(sessionUser);
        setAuthError(error instanceof Error ? error.message : "Falha ao carregar o perfil.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    // O supabase-js emite INITIAL_SESSION ao registrar o listener, então ele
    // sozinho já cobre a sessão existente — chamar getSession() em paralelo
    // (como antes) dobrava as consultas de perfil a cada montagem.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED não muda quem é o usuário; re-hidratar aí só gera
      // tráfego extra a cada renovação de token.
      if (event === "TOKEN_REFRESHED" && sessionUserHydratedFor === session?.user?.id) return;

      const uid = session?.user?.id ?? null;
      // Defer para evitar deadlock do Supabase ao chamar APIs dentro do callback.
      setTimeout(() => {
        void hydrateSessionUser(uid);
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;
    const u = await hydrateUser(uid);
    setSessionUser(u);
    setUser(u);
  }, []);

  const login: AuthContextValue["login"] = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { ok: false, error: isNetworkError(error) ? NETWORK_ERROR_MESSAGE : error.message };
    }
    if (!data.user) return { ok: false, error: "Falha no login." };
    const u = await hydrateUser(data.user.id);
    if (!u) return { ok: false, error: "Perfil não encontrado." };
    setSessionUser(u);
    setUser(u);
    setAuthError(null);
    setLoading(false);
    return { ok: true, user: u };
  }, []);

  const signUp: AuthContextValue["signUp"] = useCallback(async (input) => {
    const region = normalizeRegion(input);
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          name: input.name,
          phone: input.phone,
          unity: input.unit,
          region,
          state: input.state ?? null,
          self_signup: true,
        },
      },
    });
    if (error) {
      return { ok: false, error: isNetworkError(error) ? NETWORK_ERROR_MESSAGE : error.message };
    }
    // Ensure a session (auto-confirm on → signUp already returns a session; if not, sign in).
    let userId = data.user?.id ?? null;
    if (!data.session) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: input.email.trim(),
        password: input.password,
      });
      if (signInErr || !signInData.user) {
        return {
          ok: false,
          error:
            "Conta criada, mas não foi possível autenticar automaticamente. Faça login manualmente.",
        };
      }
      userId = signInData.user.id;
    }
    if (!userId) return { ok: false, error: "Falha ao criar conta." };

    // Complete the profile with state + mark as not first access (user chose own password).
    await supabase
      .from("profiles")
      .update({
        state: input.state ?? null,
        is_first_access: false,
        status: "Ativo",
      })
      .eq("id", userId);

    const u = await hydrateUser(userId);
    if (!u) return { ok: false, error: "Perfil não encontrado após cadastro." };
    setSessionUser(u);
    setUser(u);
    setLoading(false);
    return { ok: true, user: u };
  }, []);

  const logout = useCallback(async () => {
    clearAllCaches();
    setSessionUser(null);
    await supabase.auth.signOut();
    setUser(null);
    setAuthError(null);
    setLoading(false);
  }, []);


  const changePassword: AuthContextValue["changePassword"] = useCallback(
    async (newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message };
      if (user) {
        await supabase.from("profiles").update({ is_first_access: false }).eq("id", user.id);
        const next = { ...user, isFirstAccess: false };
        setSessionUser(next);
        setUser(next);
      }
      return { ok: true };
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isHydrated: !loading,
        authError,
        refresh,
        login,
        signUp,
        logout,
        changePassword,
      }}
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
