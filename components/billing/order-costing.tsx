"use client";

import { AlertTriangle, ChefHat, IndianRupee, Leaf, Truck, Users } from "lucide-react";
import * as React from "react";
import { DocHeader, docStyle, useDocs } from "@/components/documents/theme";
import { Badge } from "@/components/shared/badges";
import { StatCard } from "@/components/shared/blocks";
import { Card, CardTitle } from "@/components/ui/primitives";
import { balanceOf, useBilling } from "@/lib/billing";
import { costOrder, type OrderCost } from "@/lib/costing";
import { useExpenses, categoryLabel } from "@/lib/expenses";
import { useOps } from "@/lib/operations";
import { priceQuote } from "@/lib/pricing";
import { taskAmount, useStaff } from "@/lib/staff";
import { useStore } from "@/lib/store";
import { fmtQty } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import { sections } from "@/lib/supply-types";
import type { Order } from "@/lib/types";
import { cn, fmtDate, money, num, rate } from "@/lib/utils";
import { DownloadPdf } from "@/components/documents/doc-actions";

/** One order's costing, from everything the platform holds about it. Null until the supply side has loaded. */
export function useOrderCost(order: Order, estimate = false): OrderCost | null {
  const { items, packages, tenant } = useStore();
  const supply = useSupply();
  const { tasks, workers } = useStaff();
  const trips = useOps((s) => s.trips);
  const expenses = useExpenses((s) => s.expenses);
  const credits = useBilling((s) => s.credits);
  return React.useMemo(() => {
    if (!supply.ready) return null;
    const grand = priceQuote(order, items, packages, tenant.slabs).grand;
    return costOrder(order, {
      items,
      packages,
      slabs: tenant.slabs,
      recipes: supply.recipes,
      ingredients: supply.ingredients,
      vendors: supply.vendors,
      outsourceOrders: supply.outsourceOrders,
      vendorItems: supply.vendorItems,
      tasks: tasks.map((t) => ({ orderId: t.orderId, functionId: t.functionId, title: t.title, role: t.role, workerId: t.workerId, qty: t.qty, rate: t.rate, amount: taskAmount(t, workers) })),
      trips,
      challans: supply.challans,
      assets: supply.assets,
      expenses: expenses.map((e) => ({ orderId: e.orderId, category: categoryLabel(e.category), amount: e.amount, paidTo: e.paidTo, note: e.note })),
      credited: balanceOf(order, grand, credits).credited,
      ...(estimate ? { staffPay: usualPay(workers) } : {}),
    });
  }, [order, items, packages, tenant.slabs, supply, tasks, workers, trips, expenses, credits, estimate]);
}

/** What a worker in each role is usually paid for an event (their rate per event, else per day), averaged by role. */
function usualPay(workers: { role: string; rateEvent: number; rateDay: number; active: boolean }[]) {
  const by = new Map<string, number[]>();
  for (const w of workers) {
    const pay = w.rateEvent || w.rateDay;
    if (!w.active || !pay) continue;
    const k = w.role.trim().toLowerCase();
    by.set(k, [...(by.get(k) ?? []), pay]);
  }
  return new Map([...by].map(([k, v]) => [k, Math.round(v.reduce((s, x) => s + x, 0) / v.length)]));
}

const pct = (n: number) => `${Math.round(n)}%`;
const tone = (m: number) => (m >= 35 ? "success" : m >= 20 ? "warning" : "danger");

/** Order → Costing: what the order costs, part by part and event by event, and what it earns. Owner and accounts only. */
export function CostingTab({ order, estimate }: { order: Order; /** Cost Calculator: no PDF, no client, staff at usual pay */ estimate?: boolean }) {
  const cost = useOrderCost(order, estimate);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  if (!cost) return <Card className="p-6 text-sm text-text-muted">Loading the costing...</Card>;
  const { totals, gaps } = cost;
  const parts = [
    { key: "material", label: "Raw material", icon: Leaf, amount: totals.material, help: "Recipes at the latest purchase rate, for each dish's kitchen guests" },
    { key: "vendors", label: "Third-party food and services", icon: ChefHat, amount: totals.vendors, help: "Agency orders, or the menu at each dish's agency rate, and extra services given to vendors" },
    { key: "labour", label: "Staff", icon: Users, amount: totals.labour, help: estimate ? "In-house staff lines at your workers' usual pay for the role" : "Tasks planned in Staff and Tasks" },
    { key: "transport", label: "Transport", icon: Truck, amount: totals.transport, help: "Trips on the dispatch board" },
    { key: "rentals", label: "Cutlery hire and breakage", icon: IndianRupee, amount: totals.rentals, help: "From the cutlery challans" },
    { key: "expenses", label: "Other expenses", icon: IndianRupee, amount: totals.expenses, help: "Expenses booked to this order" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">For you and your accountant only: the client never sees this.</p>
        {!estimate && <DownloadPdf kind="costing" id={order.id} lang="en" label="Costing sheet PDF" />}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={estimate ? "This menu earns (before GST)" : "Order earns (before GST)"} value={money(cost.revenue)} sub={`Bill with GST ${money(cost.grand)}`} />
        <StatCard label="Costs" value={money(totals.cost)} sub={`${pct(cost.revenue ? (totals.cost / cost.revenue) * 100 : 0)} of the bill`} />
        <StatCard label="Profit" value={money(cost.profit)} sub="Before your overheads" tone={cost.profit >= 0 ? "success" : "warning"} />
        <StatCard label="Margin" value={pct(cost.margin)} sub="Profit over the bill" tone="info" />
      </div>

      <Gaps cost={cost} />

      <Card>
        <CardTitle>Where the money goes</CardTitle>
        <ul className="divide-y">
          {parts.map((p) => {
            const share = cost.revenue ? (p.amount / cost.revenue) * 100 : 0;
            return (
              <li key={p.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 md:px-5">
                <p.icon className="size-4 shrink-0 text-text-muted" strokeWidth={1.75} />
                <div className="min-w-0 flex-1 basis-48"><p className="text-sm font-medium">{p.label}</p><p className="text-xs text-text-muted">{p.help}</p></div>
                <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-surface-muted sm:block"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, share)}%` }} /></div>
                <span className="tnum w-12 text-right text-xs text-text-muted">{pct(share)}</span>
                <span className="tnum w-28 text-right font-semibold">{money(p.amount)}</span>
              </li>
            );
          })}
          <li className="tnum flex justify-between px-4 py-3 font-heading md:px-5"><span className="font-semibold">Profit</span><span className={cn("text-lg font-bold", cost.profit < 0 && "text-danger")}>{money(cost.profit)}</span></li>
        </ul>
      </Card>

      <EventsTable cost={cost} />
      <MaterialTable cost={cost} />
      <VendorTable cost={cost} />
      {(cost.labour.length > 0 || cost.other.length > 0) && <OtherTable cost={cost} />}
      {estimate ? <p className="text-xs text-text-muted">Worked out from this menu and its extras: raw material from the recipes at the latest rates, third-party dishes at their agency rates, vendors at their price lists and in-house staff at your workers&apos; usual pay. Transport, cutlery hire and other expenses are counted once it is booked.</p> : <p className="text-xs text-text-muted">{client?.name} · {order.number}. Figures follow the order as it stands: change the kitchen guests, recipes, agency rates or raw material rates, and the costing follows. {gaps.noLabour && cost.staffCharged > 0 ? `The client pays ${money(cost.staffCharged)} for staff on this order; plan the staff in Staff and Tasks to count what they cost you.` : ""}</p>}
    </div>
  );
}

function Gaps({ cost }: { cost: OrderCost }) {
  const { gaps } = cost;
  const list = [
    gaps.noRecipe.length > 0 && `${gaps.noRecipe.length} ${gaps.noRecipe.length === 1 ? "dish has" : "dishes have"} no recipe, so their raw material is not counted: ${gaps.noRecipe.slice(0, 6).join(", ")}${gaps.noRecipe.length > 6 ? "..." : ""}`,
    gaps.noRate.length > 0 && `${gaps.noRate.length} raw ${gaps.noRate.length === 1 ? "material has" : "materials have"} no rate yet: ${gaps.noRate.slice(0, 6).join(", ")}${gaps.noRate.length > 6 ? "..." : ""}`,
    gaps.noAgencyRate.length > 0 && `${gaps.noAgencyRate.length} third-party ${gaps.noAgencyRate.length === 1 ? "dish has" : "dishes have"} no agency rate: ${gaps.noAgencyRate.slice(0, 6).join(", ")}${gaps.noAgencyRate.length > 6 ? "..." : ""}`,
    gaps.noLabour && "No staff is planned for this order yet, so staff cost is not counted.",
  ].filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <Card className="border-warning/40 bg-warning/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-warning"><AlertTriangle className="size-4" strokeWidth={1.75} />Some costs are missing, so the real profit is lower than shown</p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-xs text-text-muted">{list.map((x) => <li key={x}>{x}</li>)}</ul>
    </Card>
  );
}

function EventsTable({ cost }: { cost: OrderCost }) {
  return (
    <Card className="overflow-hidden">
      <CardTitle>By event</CardTitle>
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[720px] text-sm">
          <thead className="bg-surface-muted text-left text-xs text-text-muted"><tr>{["Event", "Guests", "Earns", "Raw material", "Third-party", "Staff", "Other", "Profit", "Margin"].map((h, i) => <th key={h} className={cn("px-4 py-2 font-medium", i && "text-right")}>{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {cost.events.map((e) => (
              <tr key={e.fn.id}>
                <td className="px-4 py-2"><span className="font-medium">{e.fn.name}</span><span className="block text-xs text-text-muted">{fmtDate(e.fn.date, { day: "numeric", month: "short" })}</span></td>
                <td className="px-4 py-2 text-right">{num(e.fn.pax)}</td>
                <td className="px-4 py-2 text-right">{money(e.revenue)}</td>
                <td className="px-4 py-2 text-right">{money(e.material)}</td>
                <td className="px-4 py-2 text-right">{money(e.vendors)}</td>
                <td className="px-4 py-2 text-right">{money(e.labour)}</td>
                <td className="px-4 py-2 text-right">{money(e.other)}</td>
                <td className={cn("px-4 py-2 text-right font-semibold", e.profit < 0 && "text-danger")}>{money(e.profit)}</td>
                <td className="px-4 py-2 text-right"><Badge tone={tone(e.revenue ? (e.profit / e.revenue) * 100 : 0)}>{pct(e.revenue ? (e.profit / e.revenue) * 100 : 0)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MaterialTable({ cost }: { cost: OrderCost }) {
  if (!cost.material.length) return null;
  return (
    <Card className="overflow-hidden">
      <CardTitle action={<span className="tnum text-sm font-semibold">{money(cost.totals.material)}</span>}>Raw material · {cost.material.length} items</CardTitle>
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[560px] text-sm">
          <thead className="bg-surface-muted text-left text-xs text-text-muted"><tr>{["Raw material", "Section", "Quantity", "Rate", "Amount"].map((h, i) => <th key={h} className={cn("px-4 py-2 font-medium", i > 1 && "text-right")}>{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {cost.material.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-1.5" data-no-title-case>{l.name}</td>
                <td className="px-4 py-1.5 text-text-muted">{sections.find((s) => s.id === l.section)?.label ?? l.section}</td>
                <td className="px-4 py-1.5 text-right">{fmtQty(l.qty)} {l.unit}</td>
                <td className={cn("px-4 py-1.5 text-right", !l.rate && "text-warning")}>{l.rate ? rate(l.rate) : "No rate"}</td>
                <td className="px-4 py-1.5 text-right font-medium">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function VendorTable({ cost }: { cost: OrderCost }) {
  if (!cost.vendors.length) return null;
  const fnName = (id: string) => cost.events.find((e) => e.fn.id === id)?.fn.name ?? "";
  return (
    <Card className="overflow-hidden">
      <CardTitle action={<span className="tnum text-sm font-semibold">{money(cost.totals.vendors)}</span>}>Third-party food and services · {cost.vendors.length} lines</CardTitle>
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[640px] text-sm">
          <thead className="bg-surface-muted text-left text-xs text-text-muted"><tr>{["Dish", "Vendor", "Event", "Quantity", "Agency rate", "Amount"].map((h, i) => <th key={h} className={cn("px-4 py-2 font-medium", i > 2 && "text-right")}>{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {cost.vendors.map((l) => (
              <tr key={`${l.functionId}-${l.itemId}`}>
                <td className="px-4 py-1.5" data-no-title-case>{l.dish}{l.estimated && <span className="ml-1.5 text-xs text-text-muted">(from the menu)</span>}</td>
                <td className="px-4 py-1.5 text-text-muted" data-no-title-case>{l.vendor}</td>
                <td className="px-4 py-1.5 text-text-muted">{fnName(l.functionId)}</td>
                <td className="px-4 py-1.5 text-right">{num(l.qty)}</td>
                <td className={cn("px-4 py-1.5 text-right", !l.rate && "text-warning")}>{l.rate ? rate(l.rate) : "No rate"}</td>
                <td className="px-4 py-1.5 text-right font-medium">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function OtherTable({ cost }: { cost: OrderCost }) {
  const rows = [...cost.labour.map((l) => ({ ...l, kind: "Staff" })), ...cost.other.map((l) => ({ ...l, kind: l.kind === "transport" ? "Transport" : l.kind === "expense" ? "Expense" : "Cutlery" }))];
  return (
    <Card className="overflow-hidden">
      <CardTitle action={<span className="tnum text-sm font-semibold">{money(cost.totals.labour + cost.totals.transport + cost.totals.rentals + cost.totals.expenses)}</span>}>Staff, transport and other costs</CardTitle>
      <ul className="divide-y">
        {rows.map((r, i) => <li key={i} className="tnum flex justify-between gap-3 px-4 py-2 text-sm md:px-5"><span className="min-w-0"><span className="mr-2 text-xs text-text-muted">{r.kind}</span>{r.label}</span><span className="font-medium">{money(r.amount)}</span></li>)}
      </ul>
    </Card>
  );
}

/** The costing as an A4 sheet, for the PDF: the same figures as the Costing tab. */
export function CostingDoc({ order }: { order: Order }) {
  const cost = useOrderCost(order);
  const tenant = useStore((s) => s.tenant);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const docs = useDocs();
  if (!cost) return null;
  const th = "py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#6b6158]";
  const parts: [string, number][] = [["Raw material", cost.totals.material], ["Third-party food and services", cost.totals.vendors], ["Staff", cost.totals.labour], ["Transport", cost.totals.transport], ["Cutlery hire and breakage", cost.totals.rentals], ["Other expenses", cost.totals.expenses]];
  const fnName = (id: string) => cost.events.find((e) => e.fn.id === id)?.fn.name ?? "";
  return (
    <article className="bg-white text-[12px] leading-relaxed text-[#1f1a17]" style={docStyle(tenant.brandColor, docs.theme)}>
      <DocHeader title="Order costing" lines={[order.number, `Printed ${fmtDate(new Date().toISOString().slice(0, 10))}`, "Internal, not for the client"]} />
      <section className="grid grid-cols-4 gap-3 border-b px-8 py-4">
        {[["Client", client?.name ?? ""], ["Earns before GST", money(cost.revenue)], ["Costs", money(cost.totals.cost)], ["Profit", `${money(cost.profit)} (${pct(cost.margin)})`]].map(([k, v]) => (
          <div key={k}><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6158]">{k}</p><p className="font-heading text-[15px] font-semibold">{v}</p></div>
        ))}
      </section>
      <section className="px-8 py-3">
        <table className="tnum w-full">
          <thead><tr className="border-b text-left"><th className={th}>Cost</th><th className={`${th} text-right`}>Of the bill</th><th className={`${th} text-right`}>Amount</th></tr></thead>
          <tbody className="divide-y">{parts.map(([k, v]) => <tr key={k}><td className="py-1">{k}</td><td className="py-1 text-right">{pct(cost.revenue ? (v / cost.revenue) * 100 : 0)}</td><td className="py-1 text-right">{money(v)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-brand"><td className="py-1.5 font-semibold" colSpan={2}>Profit</td><td className="py-1.5 text-right font-heading text-[15px] font-bold">{money(cost.profit)}</td></tr></tfoot>
        </table>
      </section>
      <section className="break-inside-avoid px-8 py-3">
        <p className="mb-1 font-heading text-[13px] font-semibold">By event</p>
        <table className="tnum w-full">
          <thead><tr className="border-b text-left">{["Event", "Guests", "Earns", "Material", "Third-party", "Staff", "Other", "Profit"].map((h, i) => <th key={h} className={cn(th, i && "text-right")}>{h}</th>)}</tr></thead>
          <tbody className="divide-y">{cost.events.map((e) => <tr key={e.fn.id}><td className="py-1">{e.fn.name} <span className="text-[#6b6158]">{fmtDate(e.fn.date, { day: "numeric", month: "short" })}</span></td><td className="py-1 text-right">{num(e.fn.pax)}</td><td className="py-1 text-right">{money(e.revenue)}</td><td className="py-1 text-right">{money(e.material)}</td><td className="py-1 text-right">{money(e.vendors)}</td><td className="py-1 text-right">{money(e.labour)}</td><td className="py-1 text-right">{money(e.other)}</td><td className="py-1 text-right font-medium">{money(e.profit)}</td></tr>)}</tbody>
        </table>
      </section>
      {cost.material.length > 0 && (
        <section className="px-8 py-3">
          <p className="mb-1 font-heading text-[13px] font-semibold">Raw material · {money(cost.totals.material)}</p>
          <table className="tnum w-full">
            <thead><tr className="border-b text-left">{["Raw material", "Quantity", "Rate", "Amount"].map((h, i) => <th key={h} className={cn(th, i && "text-right")}>{h}</th>)}</tr></thead>
            <tbody className="divide-y">{cost.material.map((l) => <tr key={l.id} className="break-inside-avoid"><td className="py-0.5">{l.name}</td><td className="py-0.5 text-right">{fmtQty(l.qty)} {l.unit}</td><td className="py-0.5 text-right">{l.rate ? rate(l.rate) : "No rate"}</td><td className="py-0.5 text-right">{money(l.amount)}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      {cost.vendors.length > 0 && (
        <section className="px-8 py-3">
          <p className="mb-1 font-heading text-[13px] font-semibold">Third-party food and services · {money(cost.totals.vendors)}</p>
          <table className="tnum w-full">
            <thead><tr className="border-b text-left">{["Dish", "Vendor", "Event", "Quantity", "Rate", "Amount"].map((h, i) => <th key={h} className={cn(th, i > 2 && "text-right")}>{h}</th>)}</tr></thead>
            <tbody className="divide-y">{cost.vendors.map((l) => <tr key={`${l.functionId}-${l.itemId}`} className="break-inside-avoid"><td className="py-0.5">{l.dish}</td><td className="py-0.5">{l.vendor}</td><td className="py-0.5">{fnName(l.functionId)}</td><td className="py-0.5 text-right">{num(l.qty)}</td><td className="py-0.5 text-right">{l.rate ? rate(l.rate) : "No rate"}</td><td className="py-0.5 text-right">{money(l.amount)}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      {(cost.labour.length > 0 || cost.other.length > 0) && (
        <section className="px-8 py-3">
          <p className="mb-1 font-heading text-[13px] font-semibold">Staff, transport and other</p>
          <table className="tnum w-full"><tbody className="divide-y">{[...cost.labour, ...cost.other].map((l, i) => <tr key={i}><td className="py-0.5">{l.label}</td><td className="py-0.5 text-right">{money(l.amount)}</td></tr>)}</tbody></table>
        </section>
      )}
      <footer className="px-8 pb-6 pt-2 text-[10px] text-[#6b6158]">
        {[cost.gaps.noRecipe.length && `${cost.gaps.noRecipe.length} dishes without a recipe`, cost.gaps.noRate.length && `${cost.gaps.noRate.length} raw materials without a rate`, cost.gaps.noAgencyRate.length && `${cost.gaps.noAgencyRate.length} third-party dishes without an agency rate`, cost.gaps.noLabour && "no staff planned"].filter(Boolean).length > 0 && (
          <p>Not counted yet: {[cost.gaps.noRecipe.length && `${cost.gaps.noRecipe.length} dishes without a recipe`, cost.gaps.noRate.length && `${cost.gaps.noRate.length} raw materials without a rate`, cost.gaps.noAgencyRate.length && `${cost.gaps.noAgencyRate.length} third-party dishes without an agency rate`, cost.gaps.noLabour && "no staff planned"].filter(Boolean).join(", ")}. The real profit is lower than shown.</p>
        )}
        <p className="mt-1">{tenant.name} · {client?.name} · {order.number}</p>
      </footer>
    </article>
  );
}
