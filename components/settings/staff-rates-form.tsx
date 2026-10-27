"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStaff, workerRoles } from "@/lib/staff";
import { useCurrentUser, useStore } from "@/lib/store";
import type { StaffRate } from "@/lib/types";
import { rate } from "@/lib/utils";

/**
 * What the client is charged per event for each staff role. These fill in when staff are added to an event in a
 * quotation or booking, and can still be changed there. Kept apart from the wages in Staff and Tasks.
 */
export function StaffRatesForm() {
  const ready = useStore((s) => s.chargesReady);
  const rates = useStore((s) => s.tenant.staffRates ?? []);
  const updateTenant = useStore((s) => s.updateTenant);
  const workers = useStaff((s) => s.workers);
  const isOwner = useCurrentUser().role === "owner";
  const [name, setName] = React.useState("");

  if (!ready) return <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning">Run supabase/migrations/0018_event_charges.sql in the Supabase SQL editor, then reload, to set staff rates.</p>;

  const save = (next: StaffRate[]) => updateTenant({ staffRates: next });
  /** What you pay one person in this role for an event, on average, from Staff and Tasks. */
  const wage = (role: string) => {
    const paid = workers.filter((w) => w.active && w.role.toLowerCase() === role.toLowerCase()).map((w) => w.rateEvent || w.rateDay).filter((v) => v > 0);
    return paid.length ? Math.round(paid.reduce((s, v) => s + v, 0) / paid.length) : 0;
  };
  const add = () => {
    const n = name.trim();
    if (!n || rates.some((r) => r.name.toLowerCase() === n.toLowerCase())) return;
    save([...rates, { name: n, rate: 0 }]);
    setName("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Service staff rates</h2>
        <p className="text-sm text-text-muted">What you charge the client for one person for one event. They fill in when you add staff to an event in a quotation or booking, and can be changed there for that booking.</p>
      </div>
      {rates.length === 0 && (
        <div className="rounded-xl border border-dashed p-4 text-sm text-text-muted">
          No rates yet.
          {isOwner && <Button className="ml-2" variant="ghost" onClick={() => save(workerRoles.map((r) => ({ name: r, rate: 0 })))}><RotateCcw strokeWidth={1.75} />Start with the usual roles</Button>}
        </div>
      )}
      <ul className="divide-y rounded-xl border">
        {rates.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <Input aria-label={`Name of ${r.name}`} value={r.name} disabled={!isOwner} onChange={(e) => save(rates.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="min-w-40 flex-1" />
            <MoneyInput label={`Rate for ${r.name}`} value={r.rate} onChange={(rate) => isOwner && save(rates.map((x, j) => (j === i ? { ...x, rate } : x)))} className="w-32" />
            <span className="w-36 text-xs text-text-muted">per event{wage(r.name) ? ` · you pay ${rate(wage(r.name))}` : ""}</span>
            {isOwner && <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} onClick={() => save(rates.filter((_, j) => j !== i))}><Trash2 strokeWidth={1.75} /></Button>}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Input aria-label="New staff role" value={name} onChange={(e) => setName(e.target.value)} placeholder="Role, e.g. Bartender" className="max-w-xs" />
          <Button type="submit" disabled={!name.trim()}><Plus strokeWidth={1.75} />Add role</Button>
        </form>
      )}
      {!isOwner && <p className="text-xs text-text-muted">Only the owner can change these rates.</p>}
    </div>
  );
}
