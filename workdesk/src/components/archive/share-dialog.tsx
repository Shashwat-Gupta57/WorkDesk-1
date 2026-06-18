"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useShareArtifact, useRevokeShare, useShareGrants } from "@/modules/archive/hooks";
import { Confirm } from "@/components/ui/confirm";

// ─────────────────────────────────────────────────────────────────────────────
// Share dialog — grant / revoke per-user access to an artifact.
//
// Owner-only. Shows existing grantees with revoke option, and an email input
// to add a new grantee. Artifact visibility is managed server-side (auto-set
// to SHARED on first grant, back to PRIVATE when last grant is revoked).
// ─────────────────────────────────────────────────────────────────────────────

export function ShareDialog({
  open,
  onClose,
  artifactId,
  artifactTitle,
}: {
  open: boolean;
  onClose: () => void;
  artifactId: string;
  artifactTitle: string;
}) {
  const { data: grants = [], isLoading } = useShareGrants(artifactId, open);
  const shareArtifact = useShareArtifact(artifactId);
  const revokeShare = useRevokeShare(artifactId);

  const [email, setEmail] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    setShareError(null);
    try {
      await shareArtifact.mutateAsync(email.trim());
      setEmail("");
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : "Failed to share artifact.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Share "${artifactTitle}"`}>
      <div className="space-y-5">
        {/* Add grantee */}
        <form onSubmit={handleShare} className="space-y-3">
          <Field label="Share with (email address)" htmlFor="share-email">
            <div className="flex gap-2">
              <Input
                id="share-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1"
              />
              <Button type="submit" disabled={shareArtifact.isPending || !email.trim()}>
                {shareArtifact.isPending ? "Sharing…" : "Share"}
              </Button>
            </div>
          </Field>
          {shareError && (
            <p role="alert" className="text-sm text-danger">{shareError}</p>
          )}
        </form>

        {/* Current grantees */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
            Shared with
          </p>
          {isLoading ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : grants.length === 0 ? (
            <p className="text-sm text-text-secondary">No one yet. Enter an email above to share.</p>
          ) : (
            <ul className="divide-y divide-border-default rounded-lg border border-border-default">
              {grants.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">{g.granteeName}</p>
                    <p className="truncate text-xs text-text-secondary">{g.granteeEmail}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-7 shrink-0 text-xs text-danger hover:text-danger"
                    onClick={() => setRevokeTarget({ id: g.granteeId, name: g.granteeName })}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Revoke confirm */}
      <Confirm
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Revoke access"
        message={`Remove access for ${revokeTarget?.name}? They will no longer be able to view this artifact.`}
        confirmLabel="Revoke"
        busy={revokeShare.isPending}
        onConfirm={() => {
          if (revokeTarget) {
            revokeShare.mutate(revokeTarget.id, {
              onSuccess: () => setRevokeTarget(null),
            });
          }
        }}
      />
    </Modal>
  );
}
