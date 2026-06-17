"use client";

import { useStorageUsage } from "@/modules/archive/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Storage usage bar shown at the bottom of the sidebar.
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageUsageBar() {
  const { data, isLoading } = useStorageUsage();

  if (isLoading || !data) {
    return (
      <div className="px-1 py-2">
        <div className="h-1.5 w-full rounded-full bg-surface-container-high" />
      </div>
    );
  }

  const pct = Math.min(100, data.usedPercent);
  const barColor =
    pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary";

  return (
    <div className="px-1 py-2 space-y-1.5">
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>Storage</span>
        <span>
          {formatBytes(data.usedBytes)} / {formatBytes(data.quotaBytes)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
