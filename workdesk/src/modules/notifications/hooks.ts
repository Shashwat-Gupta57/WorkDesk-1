"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Notification, NotificationCounts } from "./types";

interface NotificationsResponse {
  notifications: Notification[];
  counts: NotificationCounts;
}

const NOTIF_KEY = ["notifications"] as const;

export function useNotifications() {
  return useQuery<NotificationsResponse>({
    queryKey: NOTIF_KEY,
    queryFn: () => api.get<NotificationsResponse>("/api/notifications"),
    refetchInterval: 30_000, // poll every 30s for new notifications
    staleTime: 10_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch("/api/notifications", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
}
