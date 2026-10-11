"use client";

import { Check, Minus, Plus, Users, MapPin, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { paidAmount, priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { cn, fmtTime, initials, money, num, parseDate } from "@/lib/utils";
import { StatusBadge } from "./badges";

export function PageHeader({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-4 md:mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children && <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">{children}</div>}
    </header>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = "neutral", href }: { label: string; value: string; sub?: string; icon?: LucideIcon; tone?: "neutral" | "warning" | "success" | "info"; href?: string }) {
  const toneCls = { neutral: "bg-surface-muted text-text-muted", warning: "bg-warning/10 text-warning", success: "bg-success/10 text-success", info: "bg-info/10 text-info" }[tone];
  const body = (
    <div className="flex h-full items-start justify-between gap-3 rounded-xl border bg-surface p-4 shadow-card md:p-5">
      <div className="min-w-0">
        <p className="line-clamp-2 text-xs font-medium text-text-muted">{label}</p>
        <p className="tnum mt-1 font-heading text-2xl font-bold md:text-3xl">{value}</p>
        {sub && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{sub}</p>}
      </div>
      {Icon && (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg max-sm:hidden", toneCls)}>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
      )}
    </div>
  );
  return href ? <Link href={href} className="block rounded-xl">{body}</Link> : body;
}

export function EmptyState({ icon: Icon, title, help, action }: { icon: LucideIcon; title: string; help: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-surface px-6 py-12 text-center">
      <span className="relative grid size-20 place-items-center rounded-full bg-primary-soft text-primary">
        <span className="absolute -right-1 top-1 size-4 rounded-full border-2 border-surface bg-accent-gold/60" aria-hidden />
        <Icon className="size-9" strokeWidth={1.5} />
      </span>
      <h3 className="mt-4 font-heading text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-text-muted">{help}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ name, className, dot }: { name: string; className?: string; dot?: "success" | "warning" | "danger" }) {
  return (
    <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary", className)}>
      {initials(name)}
      {dot && <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface", { success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[dot])} aria-hidden />}
    </span>
  );
}

export function ProgressBar({ value, tone = "success", className, label }: { value: number; tone?: "success" | "warning" | "danger" | "primary"; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-muted", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-200 ease-out", { success: "bg-success", warning: "bg-warning", danger: "bg-danger", primary: "bg-primary" }[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Large guest-count stepper with quick chips. */
export function PaxInput({ value, onChange, compact }: { value: number; onChange: (pax: number) => void; compact?: boolean }) {
  const set = (n: number) => onChange(Math.max(0, Math.min(20000, Math.round(n) || 0)));
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => set(value - 25)} className="grid size-11 shrink-0 place-items-center rounded-lg border bg-surface hover:bg-surface-muted" aria-label="25 fewer guests">
          <Minus className="size-5" strokeWidth={1.75} />
        </button>
        <label className="relative flex-1">
          <span className="sr-only">Guests</span>
          <input
            inputMode="numeric"
            value={value || ""}
            onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")))}
            className="tnum h-11 w-full rounded-lg border bg-surface-muted/60 pl-3 pr-16 text-center font-heading text-xl font-bold focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">guests</span>
        </label>
        <button type="button" onClick={() => set(value + 25)} className="grid size-11 shrink-0 place-items-center rounded-lg border bg-surface hover:bg-surface-muted" aria-label="25 more guests">
          <Plus className="size-5" strokeWidth={1.75} />
        </button>
      </div>
      {!compact && (
        <div className="mt-2 flex gap-2">
          {[100, 200, 300, 500].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set(n)}
              className={cn("tnum h-9 flex-1 rounded-full border text-sm font-medium transition-colors duration-150", value === n ? "border-primary bg-primary-soft text-primary" : "bg-surface text-text-muted hover:text-text")}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Rupee prefix, Indian digit grouping, numeric keypad on mobile. */
export function MoneyInput({ value, onChange, className, placeholder = "0", autoFocus }: { value: number; onChange: (v: number) => void; className?: string; placeholder?: string; autoFocus?: boolean }) {
  return (
    <span className={cn("relative block", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">₹</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value ? num(value) : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="tnum h-11 w-full rounded-lg border bg-surface-muted/60 pl-7 pr-3 text-sm font-medium placeholder:text-text-muted focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 md:h-9"
      />
    </span>
  );
}

export function Stepper({ steps, current, onStep }: { steps: string[]; current: number; onStep?: (index: number) => void }) {
  return (
    <ol className="no-scrollbar flex items-center gap-2 overflow-x-auto">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!onStep || i > current}
              onClick={() => onStep?.(i)}
              aria-current={active ? "step" : undefined}
              className={cn("flex h-9 items-center gap-2 rounded-full pr-3 text-sm font-medium disabled:cursor-default", active ? "text-text" : "text-text-muted")}
            >
              <span className={cn("tnum grid size-7 place-items-center rounded-full text-xs font-semibold", done ? "bg-success/10 text-success" : active ? "bg-primary text-primary-fg" : "bg-surface-muted text-text-muted")}>
                {done ? <Check className="size-4" strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={cn(!active && "hidden sm:inline")}>{label}</span>
            </button>
            {i < steps.length - 1 && <span className="h-px w-4 bg-border sm:w-8" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function DateBlock({ iso, className }: { iso: string; className?: string }) {
  const d = parseDate(iso);
  return (
    <div className={cn("grid w-14 shrink-0 place-items-center rounded-xl bg-surface-muted py-2 text-center", className)}>
      <span className="text-xs font-medium uppercase text-text-muted">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
      <span className="tnum font-heading text-xl font-bold leading-none">{d.getDate()}</span>
      <span className="mt-0.5 text-xs text-text-muted">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
    </div>
  );
}

export function useOrderMoney(order: Order) {
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const slabs = useStore((s) => s.tenant.slabs);
  return React.useMemo(() => {
    const totals = priceQuote(order, items, packages, slabs);
    const paid = paidAmount(order.payments);
    return { totals, paid, due: Math.max(0, totals.grand - paid), pct: totals.grand ? (paid / totals.grand) * 100 : 0 };
  }, [order, items, packages, slabs]);
}

/** One function of an order: date block, client and function, pax, venue, status and payment progress. */
export function EventCard({ order, functionId }: { order: Order; functionId?: string }) {
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const { paid, totals, pct } = useOrderMoney(order);
  const fn = order.functions.find((f) => f.id === functionId) ?? order.functions[0];
  if (!fn) return null;
  return (
    <Link href={`/orders/${order.id}`} className="flex min-w-0 gap-3 rounded-xl border bg-surface p-3 shadow-card transition-colors duration-150 hover:border-primary/40 md:p-4">
      <DateBlock iso={fn.date} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-heading text-base font-semibold">{client?.name}</h3>
            <p className="truncate text-sm text-text-muted">
              {fn.name} · {fmtTime(fn.time)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <span className="tnum inline-flex items-center gap-1">
            <Users className="size-3.5" strokeWidth={1.75} />
            {num(fn.pax)} guests
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{fn.venue}</span>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ProgressBar value={pct} tone={pct >= 100 ? "success" : "warning"} className="min-w-24 flex-1" label="Payment received" />
          <span className="tnum shrink-0 text-xs text-text-muted">
            {money(paid)} of {money(totals.grand)}
          </span>
        </div>
      </div>
    </Link>
  );
}
