"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BulletinSummary, BulletinDetail } from "./types";
import type { CreateBulletinInput } from "./schemas";

// ─────────────────────────────────────────────────────────────────────────────
// Bulletin hooks
// ─────────────────────────────────────────────────────────────────────────────

const bulletinKeys = {
  all: () => ["bulletin"] as const,
  list: () => ["bulletin", "list"] as const,
  detail: (id: string) => ["bulletin", "detail", id] as const,
};

export function useBulletins() {
  return useQuery<BulletinSummary[]>({
    queryKey: bulletinKeys.list(),
    queryFn: () => api.get<BulletinSummary[]>("/api/bulletin"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useBulletin(id: string, enabled = true) {
  return useQuery<BulletinDetail>({
    queryKey: bulletinKeys.detail(id),
    queryFn: () => api.get<BulletinDetail>(`/api/bulletin/${id}`),
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateBulletin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBulletinInput) =>
      api.post<BulletinSummary>("/api/bulletin", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bulletinKeys.all() });
    },
  });
}

export function useDeleteBulletin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bulletinId: string) =>
      api.delete(`/api/bulletin/${bulletinId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bulletinKeys.all() });
    },
  });
}

export function usePinBulletin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bulletinId, pinned }: { bulletinId: string; pinned: boolean }) =>
      api.put(`/api/bulletin/${bulletinId}`, { pinned }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bulletinKeys.all() });
    },
  });
}

export function useMarkComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bulletinId: string) =>
      api.post(`/api/bulletin/${bulletinId}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bulletinKeys.all() });
    },
  });
}
