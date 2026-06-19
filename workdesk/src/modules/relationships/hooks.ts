"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import type { ArtifactRelationship, GraphData } from "./types";

// ── useRelationships ──────────────────────────────────────────────────────────

export function useRelationships(artifactId: string, enabled = true) {
  return useQuery({
    queryKey: ["relationships", artifactId],
    queryFn: () => api.get<ArtifactRelationship[]>(`/api/archive/artifacts/${artifactId}/relationships`),
    enabled: enabled && Boolean(artifactId),
  });
}

// ── useCreateRelationship ─────────────────────────────────────────────────────

export function useCreateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { fromId: string; toId: string; type: string }) =>
      api.post<ArtifactRelationship>("/api/archive/relationships", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] });
      qc.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

// ── useDeleteRelationship ─────────────────────────────────────────────────────

export function useDeleteRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (relationshipId: string) =>
      api.deleteWithBody<null>("/api/archive/relationships", { relationshipId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] });
      qc.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

// ── useGraphData ──────────────────────────────────────────────────────────────

export function useGraphData(teamView: boolean) {
  return useQuery({
    queryKey: ["graph", teamView],
    queryFn: () => api.get<GraphData>(`/api/archive/graph?teamView=${teamView}`),
    staleTime: 30_000,
  });
}
