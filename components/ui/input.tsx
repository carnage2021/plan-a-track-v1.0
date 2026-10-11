import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-border bg-surface-muted/60 px-3 text-sm text-text placeholder:text-text-muted transition-colors duration-150 hover:border-text-muted/40 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-11 md:h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-20 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(field, "h-11 pr-8 md:h-9", className)} {...props}>
      {children}
    </select>
  );
}

/** Label above the field, with optional inline error (G4 forms). */
export function Field({ label, error, hint, className, children }: { label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}
