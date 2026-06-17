import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

export type UserRole = "admin" | "gestor";
export type Region = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
export type UserStatus = "Ativo" | "Inativo";

export const REGIONS: Region[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
export const DEFAULT_PASSWORD = "Sebrae@2025";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  unit: string;
  region: Region;
  role: UserRole;
  status: UserStatus;
  isFirstAccess: boolean;
}

export interface StoredUser extends AuthUser {
  password: string;
}

const SEED_USERS: StoredUser[] = [
  {
    id: "u-admin",
    email: "admin@sebrae.com.br",
    password: "admin",
    name: "Administrador SEBRAE",
    phone: "(61) 3243-0000",
    unit: "SEBRAE Nacional",
    region: "Centro-Oeste",
    role: "admin",
    status: "Ativo",
    isFirstAccess: false,
  },
  {
    id: "u-gestor-ne",
    email: "gestor.nordeste@sebrae.com.br",
    password: "sebrae123",
    name: "Gestor Regional Nordeste",
    phone: "(81) 3413-0000",
    unit: "SEBRAE/PE",
    region: "Nordeste",
    role: "gestor",
    status: "Ativo",
    isFirstAccess: true,
  },
  {
    id: "u-gestor-su",
    email: "gestor.sul@sebrae.com.br",
    password: DEFAULT_PASSWORD,
    name: "Mariana Costa",
    phone: "(51) 3216-5000",
    unit: "SEBRAE/RS",
    region: "Sul",
    role: "gestor",
    status: "Ativo",
    isFirstAccess: true,
  },
  {
    id: "u-gestor-no",
    email: "gestor.norte@sebrae.com.br",
    password: DEFAULT_PASSWORD,
    name: "Ricardo Almeida",
    phone: "(92) 3303-1500",
    unit: "SEBRAE/AM",
    region: "Norte",
    role: "gestor",
    status: "Inativo",
    isFirstAccess: false,
  },
  {
    id: "u-gestor-se",
    email: "gestor.sudeste@sebrae.com.br",
    password: DEFAULT_PASSWORD,
    name: "Patrícia Mendes",
    phone: "(11) 3177-4500",
    unit: "SEBRAE/SP",
    region: "Sudeste",
    role: "gestor",
    status: "Ativo",
    isFirstAccess: false,
  },
];

const STORAGE_USERS = "sebrae.users.v2";
const STORAGE_SESSION = "sebrae.session.v2";
const USERS_EVENT = "sebrae:users-changed";

function loadUsers(): StoredUser[] {
  if (typeof window === "undefined") return SEED_USERS;
  const raw = window.localStorage.getItem(STORAGE_USERS);
  if (!raw) {
    window.localStorage.setItem(STORAGE_USERS, JSON.stringify(SEED_USERS));
    return SEED_USERS;
  }
  try {
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return SEED_USERS;
  }
}

function saveUsers(users: StoredUser[]) {
  window.localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  window.dispatchEvent(new CustomEvent(USERS_EVENT));
}

function toAuthUser(u: StoredUser): AuthUser {
  const { password: _pw, ...rest } = u;
  return rest;
}

// ---------- Users CRUD (admin) ----------

export interface UserInput {
  name: string;
  email: string;
  phone: string;
  unit: string;
  region: Region;
  role: UserRole;
  status: UserStatus;
}

export function listUsers(): AuthUser[] {
  return loadUsers().map(toAuthUser);
}

export function createUser(input: UserInput): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const users = loadUsers();
  if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, error: "Já existe um usuário com este e-mail." };
  }
  const newUser: StoredUser = {
    id: `u-${Date.now().toString(36)}`,
    password: DEFAULT_PASSWORD,
    isFirstAccess: true,
    ...input,
  };
  saveUsers([...users, newUser]);
  return { ok: true, user: toAuthUser(newUser) };
}

export function updateUser(id: string, input: UserInput): { ok: true } | { ok: false; error: string } {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return { ok: false, error: "Usuário não encontrado." };
  if (users.some((u) => u.id !== id && u.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, error: "Já existe outro usuário com este e-mail." };
  }
  const next = [...users];
  next[idx] = { ...next[idx], ...input };
  saveUsers(next);
  return { ok: true };
}

export function deleteUser(id: string): void {
  const users = loadUsers().filter((u) => u.id !== id);
  saveUsers(users);
}

// Hook returning reactive users array
export function useUsersList(): AuthUser[] {
  const snapshot = useSyncExternalStore(
    (cb) => {
      const handler = () => cb();
      window.addEventListener(USERS_EVENT, handler);
      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener(USERS_EVENT, handler);
        window.removeEventListener("storage", handler);
      };
    },
    () => {
      const raw = window.localStorage.getItem(STORAGE_USERS) ?? "";
      return raw;
    },
    () => "",
  );
  // Recompute on snapshot change
  void snapshot;
  return listUsers();
}

// ---------- Auth context ----------

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => { ok: true; user: AuthUser } | { ok: false; error: string };
  logout: () => void;
  changePassword: (newPassword: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    loadUsers();
    const raw = window.localStorage.getItem(STORAGE_SESSION);
    if (raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const login: AuthContextValue["login"] = (email, password) => {
    const users = loadUsers();
    const match = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!match) return { ok: false, error: "E-mail ou senha inválidos." };
    if (match.status === "Inativo") {
      return { ok: false, error: "Este usuário está inativo. Contate o administrador." };
    }
    const session = toAuthUser(match);
    window.localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
    setUser(session);
    return { ok: true, user: session };
  };

  const logout = () => {
    window.localStorage.removeItem(STORAGE_SESSION);
    setUser(null);
  };

  const changePassword = (newPassword: string) => {
    if (!user) return;
    const users = loadUsers();
    const next = users.map((u) =>
      u.id === user.id ? { ...u, password: newPassword, isFirstAccess: false } : u,
    );
    saveUsers(next);
    const updated: AuthUser = { ...user, isFirstAccess: false };
    window.localStorage.setItem(STORAGE_SESSION, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
