"use client";

import { useTranslations } from "next-intl";
import type { Diet } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "success" | "primary" | "neutral" | "danger" | "gold";

const tones: Record<Tone, string> = {
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  primary: "bg-primary-soft text-primary",
  neutral: "bg-surface-muted text-text-muted",
  danger: "bg-danger/10 text-danger",
  gold: "bg-accent-gold/15 text-accent-gold",
};

const statusTone: Record<string, Tone> = {
  new: "info",
  contacted: "info",
  enquiry: "info",
  quoted: "warning",
  followup: "warning",
  booked: "success",
  lost: "danger",
  tentative: "warning",
  confirmed: "success",
  in_progress: "primary",
  completed: "neutral",
  cancelled: "danger",
  draft: "neutral",
  pending_approval: "warning",
  sent: "info",
  approved: "success",
  changes: "warning",
  rejected: "danger",
  superseded: "neutral",
  paid: "success",
  due: "warning",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium [&_svg]:size-3.5", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Status is always colour plus a translated label, never colour alone. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("status");
  return (
    <Badge tone={statusTone[status] ?? "neutral"} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t(status)}
    </Badge>
  );
}

export function statusToneOf(status: string) {
  return statusTone[status] ?? "neutral";
}

const dietStyle: Record<Diet, { cls: string; label: string }> = {
  veg: { cls: "border-success text-success", label: "Veg" },
  jain: { cls: "border-warning text-warning", label: "Jain" },
  nonveg: { cls: "border-danger text-danger", label: "Non-veg" },
};

/** Standard square-and-dot food mark. */
export function VegMark({ diet, withLabel, className }: { diet: Diet; withLabel?: boolean; className?: string }) {
  const d = dietStyle[diet];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("grid size-4 shrink-0 place-items-center rounded-[3px] border-[1.5px] bg-surface", d.cls)} role="img" aria-label={d.label} title={d.label}>
        <span className="size-1.5 rounded-full bg-current" />
      </span>
      {withLabel && <span className="text-xs text-text-muted">{d.label}</span>}
    </span>
  );
}

export const dietLabel = (diet: Diet) => dietStyle[diet].label;
