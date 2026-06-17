"use client";

import { Button } from "./button";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={"animate-spin " + className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
      />
    </svg>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-10 text-sm text-text-secondary">
      <Spinner className="h-4 w-4" />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default px-6 py-14 text-center">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-text-secondary">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-6 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
