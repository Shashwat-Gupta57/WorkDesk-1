"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import type { SafeUser } from "@/modules/auth/types";

// ─────────────────────────────────────────────────────────────────────────────
// Auth context — hydrates the current user from GET /api/auth/session.
//
// The session cookie is the source of truth (set by the login route). This hook
// fetches the fresh DB-backed user so status/role changes (e.g. suspension) are
// reflected without a re-login. A 401/403 simply means "not logged in".
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_QUERY_KEY = ["auth", "session"] as const;

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  /** Prime the cache with a just-authenticated user (call right after login). */
  setUser: (user: SafeUser) => void;
  /** Refetch the session (call after login). */
  refresh: () => Promise<void>;
  /** Clear cached session (call after logout). */
  clear: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SafeUser | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return await api.get<SafeUser>("/api/auth/session");
      } catch (err) {
        // Unauthenticated / suspended → treat as "no user", not an error state.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const value: AuthContextValue = {
    user: data ?? null,
    isLoading,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    setUser: (u: SafeUser) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, u);
    },
    clear: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return ctx;
}
