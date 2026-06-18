"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { useSharedWithMe } from "@/modules/archive/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// /archive/shared — Artifacts shared with the current user by others.
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function SharedWithMePage() {
  const { data: items, isLoading, error } = useSharedWithMe();
  const router = useRouter();

  return (
    <div className="px-8 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/archive" className="text-sm text-text-secondary hover:text-text-primary">
          ← Archive
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Shared with me</h1>
      </div>

      {isLoading && <LoadingState label="Loading shared artifacts…" />}
      {error && <ErrorState message="Failed to load shared artifacts." />}
      {!isLoading && !error && items?.length === 0 && (
        <EmptyState title="No one has shared anything with you yet." />
      )}

      {!isLoading && !error && items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-border-default bg-surface-container px-4 py-3 hover:bg-surface-container-high"
              onClick={() => router.push(`/archive/${item.id}`)}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">{item.title}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Shared by {item.ownerName} · {fmtDate(item.sharedAt)}
                  {item.description && ` · ${item.description}`}
                </p>
              </div>
              <div className="ml-4 shrink-0">
                <span className="rounded bg-surface-container-high px-2 py-0.5 text-xs text-text-secondary">
                  {item.type}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
