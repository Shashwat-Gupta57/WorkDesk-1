"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { SafeUser, UserSummary, UpdateUserPayload, UpdateProfilePayload, AuditLogEntry } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Auth / account hooks (TanStack Query)
// ─────────────────────────────────────────────────────────────────────────────

export const authKeys = {
  profile: () => ["auth", "profile"] as const,
  adminUsers: () => ["auth", "admin", "users"] as const,
  auditLogs: () => ["auth", "admin", "audit-logs"] as const,
};

// ── Own profile ──────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery<SafeUser>({
    queryKey: authKeys.profile(),
    queryFn: () => api.get<SafeUser>("/api/auth/profile"),
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      api.put<SafeUser>("/api/auth/profile", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.profile() }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      api.post<null>("/api/auth/change-password", payload),
  });
}

// ── Forgot / reset password ──────────────────────────────────────────────────

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api.post<{ resetToken?: string } | null>("/api/auth/forgot-password", { email }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: { token: string; newPassword: string; confirmPassword: string }) =>
      api.post<null>("/api/auth/reset-password", payload),
  });
}

// ── Admin: user management ───────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery<UserSummary[]>({
    queryKey: authKeys.adminUsers(),
    queryFn: () => api.get<UserSummary[]>("/api/auth/admin/users"),
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      api.put<SafeUser>(`/api/auth/admin/users/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.adminUsers() }),
  });
}

// ── Admin: audit log ─────────────────────────────────────────────────────────

export function useAuditLogs(limit = 100) {
  return useQuery<AuditLogEntry[]>({
    queryKey: [...authKeys.auditLogs(), limit],
    queryFn: () => api.get<AuditLogEntry[]>("/api/auth/admin/audit-logs", { params: { limit: String(limit) } }),
    staleTime: 15_000,
  });
}

// ── Admin: ownership transfer ─────────────────────────────────────────────────

export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { kind: "artifact" | "set"; itemId: string; newOwnerId: string }) =>
      api.put<null>("/api/archive/ownership", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["archive"] });
      qc.invalidateQueries({ queryKey: authKeys.auditLogs() });
    },
  });
}
