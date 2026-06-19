"use client";

import { useRouter } from "next/navigation";
import { useStarred } from "@/modules/archive/hooks";
import { Widget, WidgetRow, WidgetEmpty } from "./widget";

function StarIcon() {
  return (
    <svg className="h-4 w-4 text-warning" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </svg>
  );
}

export function StarredWidget() {
  const router = useRouter();
  const { data, isLoading } = useStarred();
  const artifacts = (data?.artifacts ?? []).slice(0, 3);
  const sets = (data?.sets ?? []).slice(0, 3);
  const all = [
    ...artifacts.map((a) => ({ id: a.id, label: a.title, sub: a.type, href: `/archive/${a.id}` })),
    ...sets.map((s) => ({ id: s.id, label: s.name, sub: "Set", href: `/archive?setId=${s.id}` })),
  ].slice(0, 6);

  return (
    <Widget title="Starred">
      {isLoading && <p className="text-xs text-text-secondary">Loading…</p>}
      {!isLoading && all.length === 0 && <WidgetEmpty message="No starred items yet." />}
      {all.map((item) => (
        <WidgetRow
          key={item.id}
          icon={<StarIcon />}
          label={item.label}
          sub={item.sub}
          onClick={() => router.push(item.href)}
        />
      ))}
    </Widget>
  );
}
