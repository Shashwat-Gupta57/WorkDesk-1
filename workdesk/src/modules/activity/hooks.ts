"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ActivityEvent, RecentlyOpenedItem } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Activity hooks (TanStack Query)
// ─────────────────────────────────────────────────────────────────────────────

export const activityKeys = {
  feed: (limit: number) => ["activity", "feed", limit] as const,
  recentlyOpened: (limit: number) => ["activity", "recently-opened", limit] as const,
};

export function useActivityFeed(limit = 20) {
  return useQuery<ActivityEvent[]>({
    queryKey: activityKeys.feed(limit),
    queryFn: () => api.get<ActivityEvent[]>("/api/activity/feed", { params: { limit: String(limit) } }),
    staleTime: 30_000,
  });
}

export function useRecentlyOpened(limit = 10) {
  return useQuery<RecentlyOpenedItem[]>({
    queryKey: activityKeys.recentlyOpened(limit),
    queryFn: () => api.get<RecentlyOpenedItem[]>("/api/activity/recently-opened", { params: { limit: String(limit) } }),
    staleTime: 30_000,
  });
}

/** Fire-and-forget; non-blocking. Returns a mutation for calling on artifact open. */
export function useRecordOpen() {
  return useMutation({
    mutationFn: (artifactId: string) => api.post<null>("/api/activity/record-open", { artifactId }),
  });
}
