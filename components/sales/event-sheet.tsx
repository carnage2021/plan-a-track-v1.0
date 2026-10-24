"use client";

import { Printer } from "lucide-react";
import * as React from "react";
import { VegMark } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { serviceLine, useFoodTypes } from "@/lib/services";
import { useStaff } from "@/lib/staff";
import { useStore } from "@/lib/store";
import { assetRequirement, fmtQty, functionNeed, roundQty } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import { sections } from "@/lib/supply-types";
import type { EventFunction, Order } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { fmtDate, fmtTime, num } from "@/lib/utils";

function Block({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  return (
    <section className="break-inside-avoid">
      <h4 className="border-b-2 border-text pb-1 font-heading text-sm font-bold uppercase tracking-[0.1em]">{title}</h4>
      {empty ? <p className="py-2 text-sm text-text-muted">{empty}</p> : <div className="pt-2">{children}</div>}
    </section>
  );
}

/** Everything the event manager needs for one function, on paper. */
function FunctionSheet({ order, fn }: { order: Order; fn: EventFunction }) {
  const { items, categories, clients, users, tenant } = useStore();
  const foodTypes = useFoodTypes();
  const { ingredients, recipes, assets, challans, outsourceOrders, vendors, ready: supplyReady } = useSupply();
  const { tasks, workers, ready: staffReady } = useStaff();
  const client = clients.find((c) => c.id === order.clientId);
  const manager = users.find((u) => u.id === order.managerId);
  const dishes = fn.itemIds.map((id) => items.find((i) => i.id === id)).filter((i) => !!i);
  // The order's hand changes to raw material, shared out across its functions.
  const need = functionNeed(order, fn, items, recipes);
  const raw = ingredients.filter((i) => need.has(i.id)).map((i) => ({ i, qty: roundQty(need.get(i.id)!, i.unit) }));
  // A saved challan is what actually leaves the godown; without one, the rules give the expected counts.
  const challan = challans.find((c) => c.functionId === fn.id);
  const crockery = challan
    ? challan.lines.map((l) => ({ name: assets.find((a) => a.id === l.assetId)?.name ?? "", qty: l.issued || l.required, rented: l.rentedQty }))
    : assets.map((a) => ({ name: a.name, qty: assetRequirement(a, fn, items), rented: 0 })).filter((x) => x.qty > 0);
  const agencies = outsourceOrders.filter((o) => o.functionId === fn.id && o.status !== "cancelled");
  const crew = tasks.filter((t) => t.functionId === fn.id);
  const drivers = crew.filter((t) => t.role === "Driver");

  return (
    <article className="space-y-5 text-sm [break-after:page] last:[break-after:auto]">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-brand pb-3" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{tenant.name} · Event sheet · {order.number}</p>
          <h3 className="font-heading text-2xl font-bold">{fn.name} · {client?.name}</h3>
        </div>
        <p className="tnum text-right font-heading text-3xl font-bold">{num(fn.pax)}<span className="block text-xs font-normal text-text-muted">guests</span></p>
      </header>

      <dl className="tnum grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {[["Date", fmtDate(fn.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })], ["Service", serviceLine(fn, foodTypes)], ["Venue", fn.venue || "To be confirmed"], ["Event manager", manager?.name ?? "Not set"], ["Client", client?.name ?? ""], ["Client phone", client?.phone ?? ""], ["Event type", order.eventType], ["Dishes", String(dishes.length)]].map(([k, v]) => (
          <div key={k} className="min-w-0"><dt className="text-xs text-text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      {order.instructions && <p className="rounded-lg border-2 border-warning/50 p-3"><span className="font-semibold">Special instructions: </span>{order.instructions}</p>}

      <Block title={`Menu · ${dishes.length} dishes`} empty={dishes.length ? undefined : "No dishes on this function yet."}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          {categories.map((c) => {
            const inCat = dishes.filter((d) => d.categoryId === c.id);
            if (!inCat.length) return null;
            return (
              <div key={c.id} className="break-inside-avoid">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{c.name}</p>
                <ul className="mt-1 space-y-1">{inCat.map((d) => <li key={d.id} className="flex items-start gap-2"><VegMark diet={d.diet} className="mt-0.5" /><span>{d.name}{d.outsourced && <span className="text-text-muted"> (agency)</span>}{fn.itemNotes?.[d.id] && <span className="block text-xs text-warning">{fn.itemNotes[d.id]}</span>}</span></li>)}</ul>
              </div>
            );
          })}
        </div>
      </Block>

      <Block title="Third-party food" empty={!supplyReady ? "Supply is not set up yet." : agencies.length ? undefined : "Nothing outsourced for this function."}>
        <table className="tnum w-full"><tbody className="divide-y">
          {agencies.map((o) => <tr key={o.id}><td className="py-1.5 pr-3 font-medium">{vendors.find((v) => v.id === o.vendorId)?.name}<span className="block text-xs font-normal text-text-muted">{vendors.find((v) => v.id === o.vendorId)?.phone}</span></td><td className="py-1.5 pr-3">{o.lines.map((l) => `${items.find((i) => i.id === l.itemId)?.name} × ${num(l.qty)}`).join(", ")}</td><td className="py-1.5 text-right text-xs text-text-muted">{fmtTime(o.deliverTime)} · {o.status}</td></tr>)}
        </tbody></table>
      </Block>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Block title="Raw material" empty={!supplyReady ? "Supply is not set up yet." : raw.length ? undefined : "No recipes for these dishes yet."}>
          {sections.map((s) => {
            const list = raw.filter((r) => r.i.section === s.id);
            if (!list.length) return null;
            return <div key={s.id} className="mb-2 break-inside-avoid"><p className="text-xs font-medium text-text-muted">{s.label}</p><ul className="tnum columns-2 gap-4 text-xs">{list.map((r) => <li key={r.i.id} className="flex justify-between gap-2 py-0.5"><span className="truncate">{r.i.name}</span><span className="shrink-0 font-medium">{fmtQty(r.qty)} {r.i.unit}</span></li>)}</ul></div>;
          })}
        </Block>
        <Block title={challan ? `Crockery · ${challan.number}` : "Crockery (expected)"} empty={!supplyReady ? "Supply is not set up yet." : crockery.length ? undefined : "No crockery rules set."}>
          <ul className="tnum columns-2 gap-4 text-xs">{crockery.map((c) => <li key={c.name} className="flex justify-between gap-2 py-0.5"><span className="truncate">{c.name}</span><span className="shrink-0 font-medium">{num(c.qty)}{c.rented ? ` (${num(c.rented)} rented)` : ""}</span></li>)}</ul>
        </Block>
      </div>

      <Block title={`Staff · ${crew.length}`} empty={!staffReady ? "Staff is not set up yet." : crew.length ? undefined : "No crew planned for this function."}>
        <table className="tnum w-full text-xs"><tbody className="divide-y">
          {crew.map((t) => { const w = workers.find((x) => x.id === t.workerId); return <tr key={t.id}><td className="py-1 pr-3">{t.title}</td><td className="py-1 pr-3 font-medium">{w?.name ?? "Not assigned"}</td><td className="py-1 pr-3 text-text-muted">{w?.phone}</td><td className="py-1 text-right text-text-muted">{t.role}</td></tr>; })}
        </tbody></table>
        {drivers.length > 0 && <p className="mt-2 text-xs text-text-muted">Vehicles: {drivers.map((d) => workers.find((w) => w.id === d.workerId)?.name ?? "driver not assigned").join(", ")}</p>}
      </Block>

      <footer className="flex justify-between border-t pt-2 text-xs text-text-muted"><span>Checked by ________</span><span>Client sign-off ________</span></footer>
    </article>
  );
}

export function EventSheet({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void }) {
  const functions = [...order.functions].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const [which, setWhich] = React.useState("all");
  const shown = which === "all" ? functions : functions.filter((f) => f.id === which);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Event sheet"
      description="Menu, agencies, raw material, crockery and crew for the event manager. Each function prints on its own page."
      wide
      footer={<Button variant="primary" onClick={printLight}><Printer strokeWidth={1.75} />Print {shown.length === 1 ? "sheet" : `${shown.length} sheets`}</Button>}
    >
      <Field label="Functions" className="mb-6 print:hidden">
        <Select value={which} onChange={(e) => setWhich(e.target.value)}>
          <option value="all">All {functions.length} functions</option>
          {functions.map((f) => <option key={f.id} value={f.id}>{f.name} · {fmtDate(f.date, { day: "numeric", month: "short" })} · {fmtTime(f.time)}</option>)}
        </Select>
      </Field>
      <div className="space-y-10 print:space-y-0">{shown.map((fn) => <FunctionSheet key={fn.id} order={order} fn={fn} />)}</div>
    </Sheet>
  );
}
