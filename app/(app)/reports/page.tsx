"use client";

import { BarChart3, Download, Printer } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/shared/badges";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/blocks";
import { useStock } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { balanceOf, useBilling } from "@/lib/billing";
import { useExpenses } from "@/lib/expenses";
import { useOps } from "@/lib/operations";
import { priceQuote } from "@/lib/pricing";
import { taskAmount, useStaff } from "@/lib/staff";
import { useStore } from "@/lib/store";
import { requirementFor, withOverrides } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { Order } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { cn, fmtDate, isoDate, money, moneyShort, num, parseDate, localDay } from "@/lib/utils";

/* ---------- a table every report shares: totals row, Excel (CSV) export ---------- */

interface Col<T> { key: string; label: string; value: (r: T) => string | number; money?: boolean; num?: boolean; total?: boolean; render?: (r: T) => React.ReactNode }

function ReportTable<T>({ title, rows, cols, file, empty = "Nothing in this period." }: { title: string; rows: T[]; cols: Col<T>[]; file: string; empty?: string }) {
  const fmt = (c: Col<T>, v: string | number) => (c.money ? money(Number(v)) : c.num ? num(Number(v)) : String(v));
  const totals = cols.map((c) => (c.total ? rows.reduce((s, r) => s + Number(c.value(r) || 0), 0) : null));
  const exportCsv = () => {
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => c.value(r))), ...(totals.some((t) => t !== null) ? [cols.map((c, i) => (i === 0 ? "Total" : (totals[i] ?? "")))] : [])];
    const blob = new Blob(["﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${file}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card className="break-inside-avoid">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-5">
        <h2 className="font-heading font-semibold">{title}</h2>
        <Button variant="ghost" className="print:hidden" disabled={!rows.length} onClick={exportCsv}><Download strokeWidth={1.75} />Excel</Button>
      </div>
      {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">{empty}</p> : (
        <div className="mt-2 overflow-x-auto">
          <table className="tnum w-full min-w-[640px] text-left text-sm">
            <thead className="border-y bg-surface-muted/50 text-xs text-text-muted"><tr>{cols.map((c, i) => <th key={c.key} className={cn("py-2 font-medium", i === 0 ? "px-4 md:px-5" : "pr-4", (c.money || c.num) && "text-right")}>{c.label}</th>)}</tr></thead>
            <tbody className="divide-y">{rows.map((r, n) => <tr key={n}>{cols.map((c, i) => <td key={c.key} className={cn("py-2", i === 0 ? "px-4 md:px-5" : "pr-4", (c.money || c.num) && "text-right")}>{c.render ? c.render(r) : fmt(c, c.value(r))}</td>)}</tr>)}</tbody>
            {totals.some((t) => t !== null) && <tfoot className="border-t-2 font-medium"><tr>{cols.map((c, i) => <td key={c.key} className={cn("py-2", i === 0 ? "px-4 md:px-5" : "pr-4", (c.money || c.num) && "text-right")}>{i === 0 ? "Total" : totals[i] !== null ? fmt(c, totals[i]!) : ""}</td>)}</tr></tfoot>}
          </table>
        </div>
      )}
    </Card>
  );
}

const pct = (v: number) => `${Math.round(v)}%`;
const within = (d: string, from: string, to: string) => d >= from && d <= to;

/* ---------- event profit and loss ---------- */

function useEventPL(orders: Order[]) {
  const { items, packages, tenant, clients, users } = useStore();
  const { recipes, ingredients, outsourceOrders, challans, assets } = useSupply();
  const { tasks, workers } = useStaff();
  const trips = useOps((s) => s.trips);
  const expenses = useExpenses((s) => s.expenses);
  const credits = useBilling((s) => s.credits);
  return React.useMemo(() => {
    const rate = new Map(ingredients.map((i) => [i.id, i.lastRate]));
    const replace = new Map(assets.map((a) => [a.id, a.replacementCost]));
    return orders.map((o) => {
      const t = priceQuote(o, items, packages, tenant.slabs);
      const credited = balanceOf(o, t.grand, credits).credited;
      // Revenue is the bill before GST, less credit notes (also taken before GST).
      const revenue = Math.max(0, t.taxable - credited / (1 + o.gstRate / 100));
      let material = 0;
      for (const [id, qty] of withOverrides(requirementFor(o.functions, items, recipes), o.rawOverrides)) material += qty * (rate.get(id) ?? 0);
      const outsourced = outsourceOrders.filter((x) => x.orderId === o.id && x.status !== "cancelled").reduce((s, x) => s + x.lines.reduce((a, l) => a + l.qty * l.agencyRate, 0), 0);
      const labour = tasks.filter((x) => x.orderId === o.id).reduce((s, x) => s + taskAmount(x, workers), 0);
      const transport = trips.filter((x) => x.orderId === o.id).reduce((s, x) => s + x.cost, 0);
      const mine = challans.filter((c) => c.orderId === o.id);
      const rentals = mine.reduce((s, c) => s + c.lines.reduce((a, l) => a + l.rentalCost, 0), 0);
      const breakage = mine.reduce((s, c) => s + c.lines.reduce((a, l) => a + (l.broken + l.missing) * (replace.get(l.assetId) ?? 0), 0), 0);
      const other = expenses.filter((e) => e.orderId === o.id).reduce((s, e) => s + e.amount, 0);
      const cost = material + outsourced + labour + transport + rentals + breakage + other;
      const first = [...o.functions].sort((a, b) => a.date.localeCompare(b.date))[0];
      return { o, client: clients.find((c) => c.id === o.clientId)?.name ?? "", manager: users.find((u) => u.id === o.managerId)?.name ?? "", date: first?.date ?? "", pax: t.pax, revenue, material, outsourced, labour, transport, rentals, breakage, other, cost, profit: revenue - cost, margin: revenue ? ((revenue - cost) / revenue) * 100 : 0 };
    });
  }, [orders, items, packages, tenant.slabs, clients, users, recipes, ingredients, outsourceOrders, challans, assets, tasks, workers, trips, expenses, credits]);
}

function EventPL({ orders }: { orders: Order[] }) {
  const rows = useEventPL(orders);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const profit = rows.reduce((s, r) => s + r.profit, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue before GST" value={moneyShort(revenue)} sub={`${rows.length} events`} />
        <StatCard label="Direct costs" value={moneyShort(revenue - profit)} sub="Food, labour, transport and the rest" />
        <StatCard label="Profit" value={moneyShort(profit)} sub="Before overheads" tone={profit >= 0 ? "success" : "warning"} />
        <StatCard label="Margin" value={pct(revenue ? (profit / revenue) * 100 : 0)} sub="Profit over revenue" tone="info" />
      </div>
      <ReportTable
        title="Profit and loss by event"
        file="event-profit-and-loss"
        rows={[...rows].sort((a, b) => a.date.localeCompare(b.date))}
        cols={[
          { key: "e", label: "Event", value: (r) => `${r.client} · ${r.o.eventType} (${r.o.number})`, render: (r) => <Link href={`/orders/${r.o.id}`} className="hover:underline"><span className="block font-medium">{r.client}</span><span className="block text-xs text-text-muted">{r.o.eventType} · {r.date && fmtDate(r.date, { day: "numeric", month: "short" })}</span></Link> },
          { key: "rev", label: "Revenue", value: (r) => Math.round(r.revenue), money: true, total: true },
          { key: "mat", label: "Raw material", value: (r) => Math.round(r.material), money: true, total: true },
          { key: "out", label: "Outsourced", value: (r) => Math.round(r.outsourced), money: true, total: true },
          { key: "lab", label: "Labour", value: (r) => Math.round(r.labour), money: true, total: true },
          { key: "tr", label: "Transport", value: (r) => Math.round(r.transport), money: true, total: true },
          { key: "ren", label: "Rentals and breakage", value: (r) => Math.round(r.rentals + r.breakage), money: true, total: true },
          { key: "ex", label: "Expenses", value: (r) => Math.round(r.other), money: true, total: true },
          { key: "p", label: "Profit", value: (r) => Math.round(r.profit), money: true, total: true, render: (r) => <span className={cn("font-semibold", r.profit < 0 && "text-danger")}>{money(Math.round(r.profit))}</span> },
          { key: "m", label: "Margin", value: (r) => pct(r.margin), render: (r) => <Badge tone={r.margin >= 35 ? "success" : r.margin >= 20 ? "warning" : "danger"}>{pct(r.margin)}</Badge> },
        ]}
      />
      <p className="text-xs text-text-muted">Raw material is costed from recipes at the latest purchase rate; labour from the tasks planned for each event. Dishes without a recipe add no material cost, so add recipes for a true margin.</p>
    </div>
  );
}

/* ---------- sales ---------- */

function Sales({ orders, from, to }: { orders: Order[]; from: string; to: string }) {
  const { items, packages, tenant, enquiries, users } = useStore();
  const grand = (o: Order) => priceQuote(o, items, packages, tenant.slabs).grand;
  const months = new Map<string, { count: number; value: number }>();
  for (const o of orders) {
    const m = o.createdAt.slice(0, 7);
    const row = months.get(m) ?? { count: 0, value: 0 };
    months.set(m, { count: row.count + 1, value: row.value + grand(o) });
  }
  const chart = [...months.entries()].sort().map(([m, v]) => ({ label: parseDate(`${m}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), value: v.value, count: v.count }));
  const group = (key: (o: Order) => string) => [...orders.reduce((map, o) => map.set(key(o), [...(map.get(key(o)) ?? []), o]), new Map<string, Order[]>()).entries()].map(([k, list]) => ({ k, count: list.length, value: list.reduce((s, o) => s + grand(o), 0) })).sort((a, b) => b.value - a.value);
  const leads = enquiries.filter((e) => within(e.createdAt?.slice(0, 10) ?? e.date, from, to));
  const booked = leads.filter((e) => e.stage === "booked").length;
  const lost = leads.filter((e) => e.stage === "lost");
  const reasons = [...lost.reduce((m, e) => m.set(e.lostReason || "No reason given", (m.get(e.lostReason || "No reason given") ?? 0) + 1), new Map<string, number>()).entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bookings" value={num(orders.length)} sub={moneyShort(orders.reduce((s, o) => s + grand(o), 0))} />
        <StatCard label="Enquiries" value={num(leads.length)} sub="In this period" />
        <StatCard label="Conversion" value={pct(leads.length ? (booked / leads.length) * 100 : 0)} sub={`${booked} booked`} tone="success" />
        <StatCard label="Lost" value={num(lost.length)} sub={reasons[0] ? `Top reason: ${reasons[0].k}` : "None"} tone="warning" />
      </div>
      {chart.length > 0 && (
        <Card className="p-4 md:p-5">
          <h2 className="font-heading font-semibold">Bookings by month</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis width={52} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickFormatter={(v: number) => moneyShort(v)} />
                <Tooltip cursor={{ fill: "var(--surface-muted)" }} formatter={(v) => [money(Number(v)), "Booked"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 12 }} />
                <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ReportTable title="By event type" file="bookings-by-event-type" rows={group((o) => o.eventType)} cols={[{ key: "k", label: "Event type", value: (r) => r.k }, { key: "c", label: "Bookings", value: (r) => r.count, num: true, total: true }, { key: "v", label: "Value", value: (r) => r.value, money: true, total: true }]} />
        <ReportTable title="By salesperson" file="bookings-by-salesperson" rows={group((o) => users.find((u) => u.id === o.managerId)?.name ?? "Not assigned")} cols={[{ key: "k", label: "Manager", value: (r) => r.k }, { key: "c", label: "Bookings", value: (r) => r.count, num: true, total: true }, { key: "v", label: "Value", value: (r) => r.value, money: true, total: true }]} />
      </div>
      <ReportTable title="Why enquiries were lost" file="lost-reasons" rows={reasons} empty="No enquiries were lost in this period." cols={[{ key: "k", label: "Reason", value: (r) => r.k }, { key: "n", label: "Enquiries", value: (r) => r.n, num: true, total: true }]} />
    </div>
  );
}

/* ---------- money owed, both ways ---------- */

function Money({ orders }: { orders: Order[] }) {
  const { items, packages, tenant, clients } = useStore();
  const credits = useBilling((s) => s.credits);
  const { vendors, bills, vendorPayments } = useSupply();
  const receivable = orders.map((o) => ({ o, client: clients.find((c) => c.id === o.clientId)?.name ?? "", ...balanceOf(o, priceQuote(o, items, packages, tenant.slabs).grand, credits) })).filter((r) => r.due > 0).sort((a, b) => b.due - a.due);
  const payable = vendors.map((v) => {
    const billed = bills.filter((b) => b.vendorId === v.id).reduce((s, b) => s + b.amount, 0);
    const paid = vendorPayments.filter((p) => p.vendorId === v.id).reduce((s, p) => s + p.amount, 0);
    return { v, billed, paid, due: billed - paid };
  }).filter((r) => r.billed || r.paid).sort((a, b) => b.due - a.due);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ReportTable title="Receivables: clients owe us" file="receivables" rows={receivable} empty="Nothing outstanding." cols={[
        { key: "c", label: "Client and order", value: (r) => `${r.client} (${r.o.number})`, render: (r) => <Link href={`/orders/${r.o.id}?tab=payments`} className="hover:underline">{r.client}<span className="block text-xs text-text-muted">{r.o.number}</span></Link> },
        { key: "b", label: "Billed", value: (r) => r.bill, money: true, total: true },
        { key: "r", label: "Received", value: (r) => r.received, money: true, total: true },
        { key: "d", label: "Due", value: (r) => r.due, money: true, total: true },
      ]} />
      <ReportTable title="Payables: we owe vendors" file="vendor-payables" rows={payable} empty="No vendor bills in the books." cols={[
        { key: "v", label: "Vendor", value: (r) => r.v.name },
        { key: "b", label: "Billed", value: (r) => r.billed, money: true, total: true },
        { key: "p", label: "Paid", value: (r) => r.paid, money: true, total: true },
        { key: "d", label: "Balance", value: (r) => r.due, money: true, total: true, render: (r) => <span className={r.due < 0 ? "text-success" : r.due > 0 ? "font-medium text-warning" : ""}>{r.due < 0 ? `${money(-r.due)} advance` : money(r.due)}</span> },
      ]} />
      <p className="text-xs text-text-muted xl:col-span-2">Receivables by age and client statements are on the Payments page. Vendor payables count every bill and payment to date.</p>
    </div>
  );
}

/* ---------- menu ---------- */

function MenuReport({ orders }: { orders: Order[] }) {
  const { items, categories } = useStore();
  const rows = React.useMemo(() => {
    const use = new Map<string, { functions: number; plates: number }>();
    for (const o of orders) for (const f of o.functions) for (const id of f.itemIds) {
      const r = use.get(id) ?? { functions: 0, plates: 0 };
      use.set(id, { functions: r.functions + 1, plates: r.plates + f.pax });
    }
    return items.filter((i) => use.has(i.id)).map((i) => {
      const u = use.get(i.id)!;
      const perPlate = i.pricingType === "plate";
      return { i, category: categories.find((c) => c.id === i.categoryId)?.name ?? "", ...u, foodCost: i.price ? (i.cost / i.price) * 100 : 0, profit: perPlate ? (i.price - i.cost) * u.plates : (i.price - i.cost) * u.functions };
    });
  }, [orders, items, categories]);
  const cols: Col<(typeof rows)[number]>[] = [
    { key: "n", label: "Dish", value: (r) => r.i.name, render: (r) => <><span className="block font-medium">{r.i.name}</span><span className="block text-xs text-text-muted">{r.category}</span></> },
    { key: "f", label: "Functions", value: (r) => r.functions, num: true },
    { key: "p", label: "Plates", value: (r) => (r.i.pricingType === "plate" ? r.plates : 0), num: true },
    { key: "c", label: "Food cost", value: (r) => pct(r.foodCost), render: (r) => <Badge tone={r.foodCost <= 35 ? "success" : r.foodCost <= 50 ? "warning" : "danger"}>{pct(r.foodCost)}</Badge> },
    { key: "pr", label: "Gross profit", value: (r) => Math.round(r.profit), money: true, total: true },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ReportTable title="Most ordered dishes" file="most-ordered-dishes" rows={[...rows].sort((a, b) => b.functions - a.functions || b.plates - a.plates).slice(0, 25)} cols={cols} />
      <ReportTable title="Most profitable dishes" file="most-profitable-dishes" rows={[...rows].sort((a, b) => b.profit - a.profit).slice(0, 25)} cols={cols} />
      <p className="text-xs text-text-muted xl:col-span-2">Food cost is the dish&apos;s cost over its menu price. Gross profit uses menu prices before package discounts.</p>
    </div>
  );
}

/* ---------- purchase, stock and wastage ---------- */

function Purchase({ from, to }: { from: string; to: string }) {
  const { vendors, bills, ingredients, movements } = useSupply();
  const stock = useStock();
  const spend = vendors.map((v) => ({ v, bills: bills.filter((b) => b.vendorId === v.id && within(b.date, from, to)) })).filter((r) => r.bills.length).map((r) => ({ name: r.v.name, count: r.bills.length, amount: r.bills.reduce((s, b) => s + b.amount, 0) })).sort((a, b) => b.amount - a.amount);
  const valuation = ingredients.map((i) => ({ i, qty: stock.get(i.id) ?? 0 })).filter((r) => r.qty > 0).map((r) => ({ ...r, value: r.qty * r.i.lastRate })).sort((a, b) => b.value - a.value);
  const wasted = movements.filter((m) => m.type === "wastage" && within(localDay(m.at), from, to)).map((m) => {
    const ing = ingredients.find((i) => i.id === m.ingredientId);
    const qty = Math.abs(m.qty);
    return { name: ing?.name ?? "", unit: ing?.unit ?? "", qty, value: qty * (m.rate ?? ing?.lastRate ?? 0), date: localDay(m.at), note: m.note };
  });
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ReportTable title="Vendor spend" file="vendor-spend" rows={spend} empty="No vendor bills in this period." cols={[{ key: "n", label: "Vendor", value: (r) => r.name }, { key: "c", label: "Bills", value: (r) => r.count, num: true, total: true }, { key: "a", label: "Amount", value: (r) => r.amount, money: true, total: true }]} />
      <ReportTable title="Stock valuation today" file="stock-valuation" rows={valuation} empty="No stock on hand." cols={[{ key: "n", label: "Ingredient", value: (r) => r.i.name }, { key: "q", label: "In stock", value: (r) => `${Math.round(r.qty * 100) / 100} ${r.i.unit}` }, { key: "r", label: "Last rate", value: (r) => r.i.lastRate, money: true }, { key: "v", label: "Value", value: (r) => Math.round(r.value), money: true, total: true }]} />
      <ReportTable title="Wastage" file="wastage" rows={wasted} empty="No wastage recorded in this period." cols={[{ key: "d", label: "Date", value: (r) => r.date }, { key: "n", label: "Ingredient", value: (r) => r.name }, { key: "q", label: "Quantity", value: (r) => `${r.qty} ${r.unit}` }, { key: "v", label: "Value", value: (r) => Math.round(r.value), money: true, total: true }, { key: "x", label: "Note", value: (r) => r.note }]} />
    </div>
  );
}

/* ---------- staff and cutlery ---------- */

function Staff({ orders, from, to }: { orders: Order[]; from: string; to: string }) {
  const { tasks, workers, payments, leaves } = useStaff();
  const dateOf = new Map(orders.flatMap((o) => o.functions.map((f) => [f.id, f.date] as const)));
  const inRange = tasks.filter((t) => dateOf.has(t.functionId));
  const rows = workers.map((w) => {
    const mine = inRange.filter((t) => t.workerId === w.id);
    const done = mine.filter((t) => t.status === "done" || t.status === "verified");
    return { w, assigned: mine.length, done: done.length, days: new Set(mine.map((t) => dateOf.get(t.functionId))).size, leave: leaves.filter((l) => l.workerId === w.id && within(l.date, from, to)).length, earned: done.reduce((s, t) => s + taskAmount(t, workers), 0), paid: payments.filter((p) => p.workerId === w.id && within(p.date, from, to)).reduce((s, p) => s + p.amount, 0) };
  }).filter((r) => r.assigned || r.paid || r.leave);
  const perEvent = orders.map((o) => ({ o, cost: tasks.filter((t) => t.orderId === o.id).reduce((s, t) => s + taskAmount(t, workers), 0), people: new Set(tasks.filter((t) => t.orderId === o.id && t.workerId).map((t) => t.workerId)).size })).filter((r) => r.cost > 0);
  const clients = useStore((s) => s.clients);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ReportTable title="Work, attendance and pay by person" file="staff-report" rows={rows} empty="No staff work in this period." cols={[
        { key: "n", label: "Worker", value: (r) => r.w.name, render: (r) => <><span className="block font-medium">{r.w.name}</span><span className="block text-xs text-text-muted">{r.w.role}</span></> },
        { key: "t", label: "Tasks done", value: (r) => `${r.done} of ${r.assigned}` },
        { key: "d", label: "Event days", value: (r) => r.days, num: true, total: true },
        { key: "l", label: "Leave days", value: (r) => r.leave, num: true, total: true },
        { key: "e", label: "Earned", value: (r) => r.earned, money: true, total: true },
        { key: "p", label: "Paid", value: (r) => r.paid, money: true, total: true },
      ]} />
      <ReportTable title="Labour cost per event" file="labour-per-event" rows={perEvent} empty="No labour planned on events in this period." cols={[
        { key: "e", label: "Event", value: (r) => `${clients.find((c) => c.id === r.o.clientId)?.name} · ${r.o.eventType}` },
        { key: "p", label: "People", value: (r) => r.people, num: true },
        { key: "c", label: "Labour cost", value: (r) => r.cost, money: true, total: true },
      ]} />
    </div>
  );
}

function Cutlery({ orders }: { orders: Order[] }) {
  const { challans, assets } = useSupply();
  const clients = useStore((s) => s.clients);
  const ids = new Set(orders.map((o) => o.id));
  const rows = challans.filter((c) => ids.has(c.orderId)).map((c) => {
    const o = orders.find((x) => x.id === c.orderId)!;
    const broken = c.lines.reduce((s, l) => s + l.broken, 0);
    const missing = c.lines.reduce((s, l) => s + l.missing, 0);
    const value = c.lines.reduce((s, l) => s + (l.broken + l.missing) * (assets.find((a) => a.id === l.assetId)?.replacementCost ?? 0), 0);
    return { c, o, broken, missing, value };
  }).filter((r) => r.broken || r.missing);
  return <ReportTable title="Cutlery and crockery lost or broken" file="cutlery-loss" rows={rows} empty="Nothing broken or missing in this period." cols={[
    { key: "e", label: "Event and challan", value: (r) => `${clients.find((c) => c.id === r.o.clientId)?.name} · ${r.c.number}` },
    { key: "b", label: "Broken", value: (r) => r.broken, num: true, total: true },
    { key: "m", label: "Missing", value: (r) => r.missing, num: true, total: true },
    { key: "v", label: "Value", value: (r) => r.value, money: true, total: true },
    { key: "ch", label: "Charged to client", value: (r) => (r.c.breakageCharged ? "Yes" : "No"), render: (r) => <Badge tone={r.c.breakageCharged ? "success" : "warning"}>{r.c.breakageCharged ? "Yes" : "No"}</Badge> },
  ]} />;
}

/* ---------- GST ---------- */

function Gst({ from, to }: { from: string; to: string }) {
  const { invoices, credits } = useBilling();
  const orders = useStore((s) => s.orders);
  const clients = useStore((s) => s.clients);
  const tax = invoices.filter((i) => i.kind === "tax" && within(i.issuedOn, from, to));
  const notes = credits.filter((c) => within(c.issuedOn, from, to)).map((c) => {
    const rate = orders.find((o) => o.id === c.orderId)?.gstRate ?? 5;
    const gst = (c.amount * rate) / (100 + rate);
    return { c, rate, taxable: c.amount - gst, gst };
  });
  const out = tax.reduce((s, i) => s + i.snapshot.gst, 0);
  const back = notes.reduce((s, n) => s + n.gst, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tax invoices" value={num(tax.length)} sub={moneyShort(tax.reduce((s, i) => s + i.total, 0))} />
        <StatCard label="Output GST" value={money(Math.round(out))} sub={`CGST ${money(Math.round(out / 2))} · SGST ${money(Math.round(out / 2))}`} />
        <StatCard label="Less credit notes" value={money(Math.round(back))} sub={`${notes.length} notes`} />
        <StatCard label="Net GST payable" value={money(Math.round(out - back))} sub="Before input credit" tone="warning" />
      </div>
      <ReportTable title="Sales register (B2B and B2C)" file="gst-sales-register" rows={tax} empty="No tax invoices in this period." cols={[
        { key: "n", label: "Invoice", value: (r) => r.number },
        { key: "d", label: "Date", value: (r) => r.issuedOn },
        { key: "c", label: "Client", value: (r) => r.snapshot.client.name },
        { key: "g", label: "Client GSTIN", value: (r) => r.snapshot.client.gstin || "Unregistered" },
        { key: "t", label: "Taxable", value: (r) => Math.round(r.snapshot.taxable), money: true, total: true },
        { key: "cg", label: "CGST", value: (r) => Math.round(r.snapshot.gst / 2), money: true, total: true },
        { key: "sg", label: "SGST", value: (r) => Math.round(r.snapshot.gst / 2), money: true, total: true },
        { key: "tot", label: "Total", value: (r) => r.total, money: true, total: true },
      ]} />
      <ReportTable title="Credit notes" file="gst-credit-notes" rows={notes} empty="No credit notes in this period." cols={[
        { key: "n", label: "Note", value: (r) => r.c.number },
        { key: "d", label: "Date", value: (r) => r.c.issuedOn },
        { key: "cl", label: "Client", value: (r) => clients.find((x) => x.id === orders.find((o) => o.id === r.c.orderId)?.clientId)?.name ?? "" },
        { key: "t", label: "Taxable", value: (r) => Math.round(r.taxable), money: true, total: true },
        { key: "g", label: "GST", value: (r) => Math.round(r.gst), money: true, total: true },
      ]} />
      <p className="text-xs text-text-muted">Output GST comes from issued tax invoices only. Vendor bills do not record GST yet, so input tax credit is not counted; take it from your purchase invoices when filing.</p>
    </div>
  );
}

/* ---------- page ---------- */

/** The Indian financial year, April to March, that today falls in. */
const fyYear = () => (new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
const fyStart = () => isoDate(new Date(fyYear(), 3, 1));
const fyEnd = () => isoDate(new Date(fyYear() + 1, 2, 31));

export default function ReportsPage() {
  const allOrders = useStore((s) => s.orders);
  const [from, setFrom] = React.useState(fyStart);
  // To the end of the year, so booked events still to come show their planned profit too.
  const [to, setTo] = React.useState(fyEnd);
  const [type, setType] = React.useState("all");
  const types = [...new Set(allOrders.map((o) => o.eventType))].sort();
  // An event belongs to the period of its first function; cancelled ones are left out.
  const orders = allOrders.filter((o) => {
    const first = [...o.functions].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? o.createdAt.slice(0, 10);
    return o.status !== "cancelled" && within(first, from, to) && (type === "all" || o.eventType === type);
  });
  return (
    <>
      <PageHeader title="Reports" subtitle="Profit per event and the health of the business. Every table exports to Excel." action={<Button onClick={printLight}><Printer strokeWidth={1.75} /><span className="max-sm:hidden">Print or PDF</span></Button>} />
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Field label="From"><Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
        <Field label="Event type"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All event types</option>{types.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <p className="tnum pb-2 text-sm text-text-muted">{num(orders.length)} events from {fmtDate(from, { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      {allOrders.length === 0 ? (
        <div className="mt-6"><EmptyState icon={BarChart3} title="No events yet" help="Reports fill in as orders, payments, purchases and staff work are recorded." /></div>
      ) : (
        <Tabs defaultValue="pl" className="mt-4">
          <TabsList>
            <TabsTrigger value="pl">Event P&amp;L</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="money">Receivables and payables</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="purchase">Purchase and stock</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="cutlery">Cutlery loss</TabsTrigger>
            <TabsTrigger value="gst">GST</TabsTrigger>
          </TabsList>
          <TabsContent value="pl"><EventPL orders={orders} /></TabsContent>
          <TabsContent value="sales"><Sales orders={orders} from={from} to={to} /></TabsContent>
          <TabsContent value="money"><Money orders={allOrders.filter((o) => o.status !== "cancelled")} /></TabsContent>
          <TabsContent value="menu"><MenuReport orders={orders} /></TabsContent>
          <TabsContent value="purchase"><Purchase from={from} to={to} /></TabsContent>
          <TabsContent value="staff"><Staff orders={orders} from={from} to={to} /></TabsContent>
          <TabsContent value="cutlery"><Cutlery orders={orders} /></TabsContent>
          <TabsContent value="gst"><Gst from={from} to={to} /></TabsContent>
        </Tabs>
      )}
    </>
  );
}
