"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Shared dashboard widget shell.
// ─────────────────────────────────────────────────────────────────────────────

export function Widget({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border-default bg-surface-secondary p-5 flex flex-col gap-3 ${className}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{title}</h2>
      {children}
    </div>
  );
}

export function WidgetRow({
  icon,
  label,
  sub,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  onClick?: () => void;
}) {
  const El = onClick ? "button" : "div";
  return (
    <El
      onClick={onClick}
      className={
        "flex items-center gap-3 rounded px-2 py-1.5 text-left -mx-2 " +
        (onClick ? "hover:bg-surface-container cursor-pointer transition-colors" : "")
      }
    >
      {icon && <span className="shrink-0 text-text-secondary">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{label}</p>
        {sub && <p className="truncate text-xs text-text-secondary">{sub}</p>}
      </div>
    </El>
  );
}

export function WidgetEmpty({ message }: { message: string }) {
  return <p className="text-xs text-text-secondary">{message}</p>;
}
