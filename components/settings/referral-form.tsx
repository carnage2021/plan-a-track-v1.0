"use client";

import * as React from "react";
import { MoneyInput } from "@/components/shared/blocks";
import { offerText } from "@/components/sales/summary-extras";
import { Field, Input } from "@/components/ui/input";
import { ToggleRow } from "@/components/ui/primitives";
import { useCurrentUser, useStore } from "@/lib/store";
import type { ReferralSettings } from "@/lib/types";
import { cn, money } from "@/lib/utils";

const starting: ReferralSettings = { enabled: false, type: "percent", value: 5, max: 5000, reward: 2000 };

/** The referral offer: what a new customer gets for a client's code, and what that client earns. */
export function ReferralForm() {
  const ready = useStore((s) => s.referralsReady);
  const tenant = useStore((s) => s.tenant);
  const updateTenant = useStore((s) => s.updateTenant);
  const isOwner = useCurrentUser().role === "owner";
  const r = { ...starting, ...tenant.referral };
  const update = (patch: Partial<ReferralSettings>) => updateTenant({ referral: { ...r, ...patch } });

  if (!ready) return <p className="text-sm text-text-muted">Run the 0014 database update to turn on referral codes.</p>;
  const locked = !isOwner;
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Every client gets a code to share, shown on their client page. A new customer who gives that code gets the discount on their quotation, and the client who shared it earns credit once the new booking is confirmed with an advance.</p>
      {locked && <p className="text-sm text-text-muted">Only the owner can change the offer.</p>}
      <ToggleRow checked={r.enabled} onCheckedChange={(enabled) => !locked && update({ enabled })} label="Referral offer is on" help="When off, codes still record who referred whom, but give no discount or credit." />
      <fieldset disabled={locked || !r.enabled} className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", !r.enabled && "opacity-60")}>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-text-muted">New customer gets</span>
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 rounded-lg border p-0.5">
              {(["percent", "amount"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={r.type === t} onClick={() => update({ type: t })} className={cn("h-9 rounded-md px-3 text-sm font-medium md:h-8", r.type === t ? "bg-primary-soft text-primary" : "text-text-muted")}>{t === "percent" ? "% Percent" : "₹ Amount"}</button>
              ))}
            </div>
            {r.type === "percent" ? (
              <Input aria-label="Discount percent" inputMode="decimal" className="tnum w-24" value={r.value || ""} onChange={(e) => update({ value: Math.min(100, Number(e.target.value.replace(/[^\d.]/g, "")) || 0) })} />
            ) : (
              <MoneyInput value={r.value} onChange={(value) => update({ value })} className="w-40" />
            )}
          </div>
        </div>
        {r.type === "percent" && (
          <Field label="Up to (₹)" hint="The most the percent can come to. 0 for no limit.">
            <MoneyInput value={r.max} onChange={(max) => update({ max })} />
          </Field>
        )}
        <Field label="Client who referred earns (₹ credit)" hint="Added to their client page when the new booking's advance comes in; used on their next quotation.">
          <MoneyInput value={r.reward} onChange={(reward) => update({ reward })} />
        </Field>
      </fieldset>
      {r.enabled && <p className="rounded-lg bg-surface-muted p-3 text-sm">Shown to customers as: <strong>{offerText(r)}</strong>{r.reward ? <> · the referrer earns <strong>{money(r.reward)}</strong> credit</> : null}</p>}
    </div>
  );
}
