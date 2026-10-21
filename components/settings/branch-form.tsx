"use client";

import { Building, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { usePlan } from "@/lib/platform";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";

/** The owner's list of branches; each one gets its own orders, stores, staff and vehicles. */
export function BranchForm() {
  const { branches, branchesEnabled, tenantId, reload } = useStore();
  const { plan } = usePlan();
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [edit, setEdit] = React.useState<{ id: string; name: string; address: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (!branchesEnabled) return <p className="rounded-xl bg-warning/10 p-4 text-sm text-warning">Run supabase/migrations/0011_labels_branches.sql in the Supabase SQL editor and reload to set up branches.</p>;
  const limit = plan?.branches ?? 1;
  const full = branches.length >= limit;

  const save = async (fn: () => PromiseLike<{ error: { message: string } | null }>, done: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return void toast.error("Not saved", { description: error.message });
    toast.success(done);
    await reload();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Branches</p>
        <p className="text-xs text-text-muted">A branch is a second kitchen or office. Pick one from the top bar to see only its orders, enquiries, stores, staff and vehicles. Anything made before branches were set up shows in every branch.</p>
      </div>
      {branches.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {branches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Building className="size-5" strokeWidth={1.75} /></span>
              {edit?.id === b.id ? (
                <>
                  <Input className="min-w-40 flex-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label="Branch name" />
                  <Input className="min-w-40 flex-1" value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} aria-label="Address" placeholder="Address" />
                  <Button variant="primary" size="icon" aria-label="Save" loading={busy} disabled={!edit.name.trim()} onClick={() => save(() => supabase().from("branches").update({ name: edit.name.trim(), address: edit.address.trim() }).eq("id", b.id), "Branch saved").then(() => setEdit(null))}><Check strokeWidth={2} /></Button>
                  <Button variant="ghost" size="icon" aria-label="Cancel" onClick={() => setEdit(null)}><X strokeWidth={1.75} /></Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1"><span className="block font-medium">{b.name}</span><span className="block truncate text-xs text-text-muted">{b.address || "No address"}</span></span>
                  <Button variant="ghost" size="icon" aria-label={`Rename ${b.name}`} onClick={() => setEdit(b)}><Pencil strokeWidth={1.75} /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${b.name}`} onClick={() => { if (window.confirm(`Remove ${b.name}? Its orders and staff stay, and show in every branch.`)) void save(() => supabase().from("branches").delete().eq("id", b.id), `${b.name} removed`); }}><Trash2 strokeWidth={1.75} /></Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-muted p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Branch name"><Input className="bg-surface" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vadodara kitchen" /></Field>
        <Field label="Address"><Input className="bg-surface" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alkapuri, Vadodara" /></Field>
        <Button variant="primary" loading={busy} disabled={!name.trim() || full} onClick={() => save(() => supabase().from("branches").insert({ tenant_id: tenantId, name: name.trim(), address: address.trim() }), `${name.trim()} added`).then(() => { setName(""); setAddress(""); })}><Plus strokeWidth={1.75} />Add branch</Button>
      </div>
      <p className="text-xs text-text-muted">{full ? `Your plan includes ${limit} ${limit === 1 ? "branch" : "branches"}. Ask us to move you to a bigger plan from Plan and billing.` : `Your plan includes up to ${limit} ${limit === 1 ? "branch" : "branches"}.`} Tie a team member to a branch from the Team tab.</p>
    </div>
  );
}
