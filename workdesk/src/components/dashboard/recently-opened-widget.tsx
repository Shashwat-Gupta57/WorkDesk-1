"use client";

import { useRouter } from "next/navigation";
import { useRecentlyOpened } from "@/modules/activity/hooks";
import { Widget, WidgetRow, WidgetEmpty } from "./widget";

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentlyOpenedWidget() {
  const router = useRouter();
  const { data, isLoading } = useRecentlyOpened(6);
  const items = data ?? [];

  return (
    <Widget title="Recently Opened">
      {isLoading && <p className="text-xs text-text-secondary">Loading…</p>}
      {!isLoading && items.length === 0 && <WidgetEmpty message="No recently opened artifacts." />}
      {items.map((item) => (
        <WidgetRow
          key={item.artifactId}
          icon={<ClockIcon />}
          label={item.title}
          sub={`${item.type} · Opened ${fmtDate(item.openedAt)}`}
          onClick={() => router.push(`/archive/${item.artifactId}`)}
        />
      ))}
    </Widget>
  );
}
