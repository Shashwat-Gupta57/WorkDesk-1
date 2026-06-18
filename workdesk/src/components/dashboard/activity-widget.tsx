"use client";

import { useActivityFeed } from "@/modules/activity/hooks";
import { Widget, WidgetEmpty } from "./widget";
import type { ActivityEvent } from "@/modules/activity/types";

// Human-readable labels for each event type
const EVENT_LABELS: Record<string, string> = {
  ARTIFACT_CREATED: "Created artifact",
  ARTIFACT_UPDATED: "Updated artifact",
  ARTIFACT_DELETED: "Moved to trash",
  ARTIFACT_RESTORED: "Restored artifact",
  VERSION_COMMITTED: "Committed new version",
  VERSION_RESTORED: "Restored version",
  SET_CREATED: "Created folder",
  SET_UPDATED: "Updated folder",
  SET_DELETED: "Deleted folder",
  SET_RESTORED: "Restored folder",
};

const EVENT_COLORS: Record<string, string> = {
  ARTIFACT_CREATED: "text-success",
  VERSION_COMMITTED: "text-success",
  SET_CREATED: "text-success",
  ARTIFACT_RESTORED: "text-primary",
  VERSION_RESTORED: "text-primary",
  SET_RESTORED: "text-primary",
  ARTIFACT_DELETED: "text-danger",
  SET_DELETED: "text-danger",
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const label = EVENT_LABELS[event.eventType] ?? event.eventType;
  const color = EVENT_COLORS[event.eventType] ?? "text-text-secondary";
  const title = event.title ?? (event.details?.title as string | undefined) ?? "—";

  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 text-xs font-medium ${color}`}>●</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary truncate">{title}</p>
        <p className="text-xs text-text-secondary">{label} · {fmtDate(event.createdAt)}</p>
      </div>
    </div>
  );
}

export function ActivityWidget() {
  const { data, isLoading } = useActivityFeed(10);
  const events = data ?? [];

  return (
    <Widget title="Activity Summary">
      {isLoading && <p className="text-xs text-text-secondary">Loading…</p>}
      {!isLoading && events.length === 0 && <WidgetEmpty message="No activity yet." />}
      {events.map((e) => (
        <ActivityRow key={e.id} event={e} />
      ))}
    </Widget>
  );
}
