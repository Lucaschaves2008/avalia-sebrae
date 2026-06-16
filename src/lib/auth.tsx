import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UserRole = "admin" | "gestor";

export interface AuthUser {
  email: string;
  name: string;
  role: UserRole;
  region?: string;
  isFirstAccess: boolean;
}

interface SeedUser extends AuthUser {
  password: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: "admin@sebrae.com.br",
    password: "admin",
    name: "Administrador SEBRAE",
    role: "admin",
    isFirstAccess: false,
  },
  {
    email: "gestor.nordeste@sebrae.com.br",
    password: "sebrae123",
    name: "Gestor Regional Nordeste",
    role: "gestor",
    region: "Nordeste",
    isFirstAccess: true,
  },
];

const STORAGE_USERS = "sebrae.users";
const STORAGE_SESSION = "sebrae.session";

function loadUsers(): SeedUser[] {
  if (typeof window === "undefined") return SEED_USERS;
  const raw = window.localStorage.getItem(STORAGE_USERS);
  if (!raw) {
    window.localStorage.setItem(STORAGE_USERS, JSON.stringify(SEED_USERS));
    return SEED_USERS;
  }
  try {
    return JSON.parse(raw) as SeedUser[];
  } catch {
    return SEED_USERS;
  }
}

function saveUsers(users: SeedUser[]) {
  window.localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

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
    const session: AuthUser = {
      email: match.email,
      name: match.name,
      role: match.role,
      region: match.region,
      isFirstAccess: match.isFirstAccess,
    };
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
      u.email === user.email ? { ...u, password: newPassword, isFirstAccess: false } : u,
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
