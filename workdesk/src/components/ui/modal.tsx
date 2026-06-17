"use client";

import { useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal accessible modal: backdrop + centered panel, Escape to close.
// ─────────────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-surface-secondary p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-text-primary">{title}</h2>
        {children}
      </div>
    </div>
  );
}
