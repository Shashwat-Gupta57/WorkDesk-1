"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const baseField =
  "w-full rounded-md border border-border-default bg-surface-container px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={baseField + " " + className} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={baseField + " resize-y " + className} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: InputHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select className={baseField + " " + className} {...(props as object)}>
      {children}
    </select>
  );
}
