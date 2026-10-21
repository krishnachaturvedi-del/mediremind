import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api, ApiError } from "../lib/api";
import type { User, Role } from "../lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateLocalUser: (u: Partial<User>) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get<{ user: User }>("/api/auth/me");
      setUser(user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setUser(null);
      // Network errors keep the previous state to avoid surprise logouts.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.post<{ user: User }>("/api/auth/login", { email, password });
    setUser(user);
    return user;
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const { user } = await api.post<{ user: User }>("/api/auth/register", input);
      setUser(user);
      return user;
    },
    []
  );

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setUser(null);
  }, []);

  const updateLocalUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refresh, updateLocalUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Redirects handled in App.tsx route guards. */
export function homePathFor(role: Role): string {
  if (role === "CHEMIST") return "/chemist";
  if (role === "CAREGIVER") return "/app/caregiver";
  return "/app/dashboard";
}
