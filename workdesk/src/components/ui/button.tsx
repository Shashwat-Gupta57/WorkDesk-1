"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  secondary:
    "border border-border-default bg-surface-container text-text-primary hover:bg-surface-container-high",
  ghost: "text-text-secondary hover:bg-surface-container hover:text-text-primary",
  danger: "bg-danger text-white hover:opacity-90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 " +
        VARIANTS[variant] +
        " " +
        className
      }
      {...props}
    />
  );
}
