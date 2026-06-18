"use client";

import { useStorageUsage } from "@/modules/archive/hooks";
import { Widget } from "./widget";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageWidget() {
  const { data, isLoading } = useStorageUsage();

  const pct = data ? Math.min(100, data.usedPercent) : 0;
  const barColor = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary";

  return (
    <Widget title="Storage Usage">
      {isLoading && <div className="h-2 w-full rounded-full bg-surface-container-high" />}
      {!isLoading && data && (
        <>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>{formatBytes(data.usedBytes)} used</span>
              <span>{formatBytes(data.quotaBytes)} quota</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            {pct.toFixed(1)}% used &mdash; {formatBytes(data.quotaBytes - data.usedBytes)} remaining
          </p>
        </>
      )}
    </Widget>
  );
}
