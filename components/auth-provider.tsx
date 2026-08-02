"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  type AuthUser,
  refreshSession,
  setAccessToken,
} from "../lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const authOperation = useRef(0);

  useEffect(() => {
    let active = true;
    const operation = authOperation.current;
    refreshSession()
      .then((session) => {
        if (active && authOperation.current === operation) {
          setUser(session.user);
        }
      })
      .catch(() => {
        if (active && authOperation.current === operation) {
          setAccessToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active && authOperation.current === operation) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    authOperation.current += 1;
    setLoading(true);
    try {
      const session = await apiRequest<{
        accessToken: string;
        user: AuthUser;
      }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
        false,
      );
      setAccessToken(session.accessToken);
      setUser(session.user);
      return session.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    authOperation.current += 1;
    try {
      await apiRequest<Record<string, never>>(
        "/auth/logout",
        { method: "POST" },
        false,
      );
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((nextUser: AuthUser) => setUser(nextUser), []);

  const value = useMemo(
    () => ({ user, loading, login, logout, updateUser }),
    [user, loading, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
