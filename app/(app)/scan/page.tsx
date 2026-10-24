"use client";

import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, ClipboardCheck, CookingPot, DatabaseZap, PackagePlus, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Scanner, type ScanResult } from "@/components/labels/scanner";
import { useLabelText } from "@/components/labels/label-sheet";
import { Badge } from "@/components/shared/badges";
import { EmptyState, PageHeader } from "@/components/shared/blocks";
import { Num } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Card, CardTitle, ToggleRow } from "@/components/ui/primitives";
import { codeFrom, statusLabel, useLabels, type StockLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { fmtQty, functionNeed } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { Challan } from "@/lib/supply-types";
import { addDays, cn, fmtDate, isoDate, num } from "@/lib/utils";

type Mode = "load" | "return" | "issue" | "receive" | "count";
const modes: { id: Mode; label: string; help: string; icon: typeof Truck }[] = [
  { id: "load", label: "Load to event", help: "Cutlery going out", icon: ArrowUpFromLine },
  { id: "return", label: "Return", help: "Cutlery coming back", icon: ArrowDownToLine },
  { id: "issue", label: "Issue to kitchen", help: "Raw material for an event", icon: CookingPot },
  { id: "receive", label: "Receive goods", help: "New delivery", icon: PackagePlus },
  { id: "count", label: "Stock count", help: "Check the shelves", icon: ClipboardCheck },
];

/** Shared by every mode: turns a scanned code into a label, with a one-line reason when it cannot be used. */
function useScanLog() {
  const find = useLabels((s) => s.find);
  const [last, setLast] = React.useState<{ tone: "ok" | "bad" | "repeat"; text: string } | null>(null);
  const lookup = React.useCallback(async (raw: string) => {
    const code = codeFrom(raw);
    const label = await find(code);
    if (!label) setLast({ tone: "bad", text: `${code}: not one of your labels` });
    return label;
  }, [find]);
  return { last, setLast, lookup };
}

function LastScan({ last }: { last: { tone: "ok" | "bad" | "repeat"; text: string } | null }) {
  if (!last) return null;
  return <p role="status" className={cn("rounded-lg px-3 py-2 text-sm font-medium", last.tone === "ok" ? "bg-success/10 text-success" : last.tone === "repeat" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger")}>{last.text}</p>;
}

function useEventName() {
  const { orders, clients } = useStore();
  return React.useCallback((orderId: string, functionId?: string) => {
    const o = orders.find((x) => x.id === orderId);
    const f = o?.functions.find((x) => x.id === functionId);
    return `${clients.find((c) => c.id === o?.clientId)?.name ?? ""}${f ? ` · ${f.name}, ${fmtDate(f.date, { day: "numeric", month: "short" })}` : ""}`;
  }, [orders, clients]);
}

/* ---------- cutlery out and back ---------- */

function Cutlery({ direction }: { direction: "load" | "return" }) {
  const challans = useSupply((s) => s.challans);
  const assets = useSupply((s) => s.assets);
  const labels = useLabels((s) => s.labels);
  const { loadOut, bringBack } = useLabels();
  const eventName = useEventName();
  const text = useLabelText();
  const { last, setLast, lookup } = useScanLog();
  const options = challans.filter((c) => (direction === "load" ? c.status !== "returned" : c.status === "issued"));
  const [challanId, setChallanId] = React.useState("");
  const challan = options.find((c) => c.id === challanId);
  const [scanned, setScanned] = React.useState<StockLabel[]>([]);
  const [loose, setLoose] = React.useState<Record<string, number>>({});
  const [broken, setBroken] = React.useState<Record<string, number>>({});
  const [markLost, setMarkLost] = React.useState(false);
  const pick = (id: string) => { setChallanId(id); setScanned([]); setLoose({}); setBroken({}); setLast(null); };

  const onCode = async (raw: string): Promise<ScanResult> => {
    if (!challan) { setLast({ tone: "bad", text: "Choose the challan first" }); return "bad"; }
    const label = await lookup(raw);
    if (!label) return "bad";
    const name = text(label).name;
    if (label.kind !== "asset") { setLast({ tone: "bad", text: `${label.code} is raw material, not cutlery` }); return "bad"; }
    if (scanned.some((s) => s.id === label.id)) { setLast({ tone: "repeat", text: `${label.code} ${name} is already counted` }); return "repeat"; }
    if (direction === "load" && label.status !== "in_store") { setLast({ tone: "bad", text: `${label.code} is ${statusLabel[label.status].toLowerCase()}${label.challanId ? `, on ${challans.find((c) => c.id === label.challanId)?.number ?? "another challan"}` : ""}` }); return "bad"; }
    if (direction === "return" && label.status === "in_store") { setLast({ tone: "repeat", text: `${label.code} is already in store` }); return "repeat"; }
    setScanned((s) => [label, ...s]);
    setLast({ tone: "ok", text: `${label.code} ${name}: ${label.single ? "1 piece" : `${label.qty} pieces`}` });
    return "ok";
  };

  // Live tally per item: what this session has scanned, against what the challan needs or sent out.
  const assetIds = [...new Set([...(challan?.lines.map((l) => l.assetId) ?? []), ...scanned.map((l) => l.itemId)])];
  const scannedQty = (assetId: string) => scanned.filter((l) => l.itemId === assetId).reduce((s, l) => s + l.qty, 0) + (loose[assetId] ?? 0);
  const expectedBack = challan ? labels.filter((l) => l.challanId === challan.id && l.status === "out") : [];
  const notBack = expectedBack.filter((l) => !scanned.some((s) => s.id === l.id));

  const finish = () => {
    if (!challan) return;
    if (direction === "load") {
      loadOut(challan, scanned, loose);
      toast.success(`${challan.number} loaded`, { description: `${scanned.length} labels scanned; the challan is marked out.` });
    } else {
      bringBack(challan, scanned, loose, broken, markLost);
      const missing = challan.lines.reduce((s, l) => s + Math.max(0, l.issued - scannedQty(l.assetId) - (broken[l.assetId] ?? 0)), 0);
      toast.success(`${challan.number} returned`, { description: missing ? `${num(missing)} pieces missing; charge breakage from the order's Cutlery tab.` : "Everything is back." });
    }
    pick("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div className="space-y-3">
        <Field label="Challan">
          <Select value={challanId} onChange={(e) => pick(e.target.value)}>
            <option value="">{options.length ? "Choose the event's challan" : direction === "load" ? "No challan to load; make one on the order's Cutlery tab" : "No challan is out right now"}</option>
            {options.map((c: Challan) => <option key={c.id} value={c.id}>{c.number} · {eventName(c.orderId, c.functionId)}</option>)}
          </Select>
        </Field>
        <Scanner onCode={onCode} paused={!challan} />
        <LastScan last={last} />
      </div>
      <Card>
        <CardTitle action={challan && <span className="tnum text-sm text-text-muted">{scanned.length} labels</span>}>{direction === "load" ? "Loading" : "Coming back"}</CardTitle>
        {!challan ? <p className="px-5 pb-5 text-sm text-text-muted">Choose a challan, then scan each bunch as it {direction === "load" ? "goes on the vehicle" : "comes off it"}.</p> : (
          <>
            <ul className="tnum divide-y">
              {assetIds.map((id) => {
                const line = challan.lines.find((l) => l.assetId === id);
                const target = direction === "load" ? (line?.required ?? 0) : (line?.issued ?? 0);
                const got = scannedQty(id);
                const done = target > 0 && got >= target;
                return (
                  <li key={id} className="space-y-2 px-4 py-3 md:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 font-medium">{assets.find((a) => a.id === id)?.name}</span>
                      <span className={cn("shrink-0 font-heading text-lg font-bold", done ? "text-success" : got > 0 ? "text-warning" : "text-text-muted")}>{num(got)}<span className="text-sm font-normal text-text-muted"> of {num(target)}</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className={cn("h-full rounded-full", done ? "bg-success" : "bg-warning")} style={{ width: `${target ? Math.min(100, (got / target) * 100) : got ? 100 : 0}%` }} /></div>
                    <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                      <label className="flex items-center gap-2">Loose pieces <Num aria-label="Loose pieces" className="h-8 w-20" value={loose[id] ?? 0} onChange={(v) => setLoose({ ...loose, [id]: v })} /></label>
                      {direction === "return" && <label className="flex items-center gap-2">Broken <Num aria-label="Broken" className="h-8 w-20" value={broken[id] ?? 0} onChange={(v) => setBroken({ ...broken, [id]: v })} /></label>}
                      {direction === "return" && line && <span className="self-center">{Math.max(0, line.issued - got - (broken[id] ?? 0)) ? <span className="text-danger">{num(Math.max(0, line.issued - got - (broken[id] ?? 0)))} missing</span> : "All back"}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {direction === "return" && notBack.length > 0 && (
              <div className="border-t px-4 py-3 text-sm md:px-5">
                <p className="font-medium">Not scanned back yet ({notBack.length})</p>
                <p className="mt-1 font-mono text-xs text-text-muted">{notBack.slice(0, 20).map((l) => l.code).join(", ")}{notBack.length > 20 ? " ..." : ""}</p>
                <div className="mt-2"><ToggleRow checked={markLost} onCheckedChange={setMarkLost} label="Mark these labels lost when finishing" /></div>
              </div>
            )}
            {scanned.length > 0 && (
              <ul className="max-h-48 divide-y overflow-y-auto border-t text-sm">
                {scanned.map((l) => <li key={l.id} className="flex items-center gap-3 px-4 py-1.5 md:px-5"><span className="font-mono text-xs font-semibold">{l.code}</span><span className="min-w-0 flex-1 truncate text-text-muted">{text(l).name} · {text(l).size}</span><Button variant="ghost" size="icon" aria-label={`Undo ${l.code}`} onClick={() => setScanned((s) => s.filter((x) => x.id !== l.id))}><Trash2 strokeWidth={1.75} /></Button></li>)}
              </ul>
            )}
            <div className="border-t p-4 md:p-5"><Button variant="primary" size="lg" className="w-full" disabled={!scanned.length && !Object.values(loose).some(Boolean)} onClick={finish}><CheckCircle2 strokeWidth={1.75} />{direction === "load" ? "Finish loading" : "Finish return"}</Button></div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ---------- raw material to the kitchen ---------- */

function Issue() {
  const { orders, items } = useStore();
  const { recipes, ingredients, movements, stores } = useSupply();
  const issue = useLabels((s) => s.issue);
  const eventName = useEventName();
  const text = useLabelText();
  const { last, setLast, lookup } = useScanLog();
  const today = isoDate(new Date());
  const soon = isoDate(addDays(new Date(), 3));
  const options = orders.filter((o) => o.status !== "cancelled" && o.functions.some((f) => f.date >= today && f.date <= soon));
  const [orderId, setOrderId] = React.useState("");
  const [storeId, setStoreId] = React.useState("");
  const [entries, setEntries] = React.useState<{ label: StockLabel; qty: number }[]>([]);
  const order = options.find((o) => o.id === orderId);
  const store = storeId || stores[0]?.id || "";
  // What the event still needs, with the order's hand changes to the raw material.
  const need = new Map<string, number>();
  if (order) for (const f of order.functions.filter((x) => x.date >= today)) for (const [id, q] of functionNeed(order, f, items, recipes)) need.set(id, (need.get(id) ?? 0) + q);
  const issuedBefore = (ingredientId: string) => -movements.filter((m) => m.orderId === orderId && m.type === "issue" && m.ingredientId === ingredientId).reduce((s, m) => s + m.qty, 0);

  const onCode = async (raw: string): Promise<ScanResult> => {
    if (!order) { setLast({ tone: "bad", text: "Choose the event first" }); return "bad"; }
    const label = await lookup(raw);
    if (!label) return "bad";
    const t = text(label);
    if (label.kind !== "ingredient") { setLast({ tone: "bad", text: `${label.code} is cutlery; use Load to event` }); return "bad"; }
    if (entries.some((e) => e.label.id === label.id)) { setLast({ tone: "repeat", text: `${label.code} ${t.name} is already on the list` }); return "repeat"; }
    if (label.status !== "in_store" || label.remaining <= 0) { setLast({ tone: "bad", text: `${label.code} is ${statusLabel[label.status].toLowerCase()}` }); return "bad"; }
    // The whole bag is the starting point; the store person lowers it when only part goes to the kitchen.
    const stillNeeded = Math.max(0, (need.get(label.itemId) ?? 0) - issuedBefore(label.itemId) - entries.filter((e) => e.label.itemId === label.itemId).reduce((s, e) => s + e.qty, 0));
    const qty = stillNeeded > 0 && stillNeeded < label.remaining ? Math.ceil(stillNeeded * 10) / 10 : label.remaining;
    setEntries((list) => [{ label, qty }, ...list]);
    setLast({ tone: "ok", text: `${label.code} ${t.name}: ${fmtQty(qty)} ${ingredients.find((i) => i.id === label.itemId)?.unit ?? ""}${qty < label.remaining ? ` of ${label.remaining}` : ""}` });
    return "ok";
  };
  const ingIds = [...new Set(entries.map((e) => e.label.itemId))];
  const finish = () => {
    issue(orderId, store, entries.filter((e) => e.qty > 0));
    toast.success("Issued to the kitchen", { description: `${entries.length} bags; stock and the event's material cost are updated.` });
    setEntries([]);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="For the event">
            <Select value={orderId} onChange={(e) => { setOrderId(e.target.value); setEntries([]); setLast(null); }}>
              <option value="">{options.length ? "Choose" : "No events in the next 3 days"}</option>
              {options.map((o) => <option key={o.id} value={o.id}>{eventName(o.id)} · {o.eventType}</option>)}
            </Select>
          </Field>
          {stores.length > 1 && <Field label="From store"><Select value={store} onChange={(e) => setStoreId(e.target.value)}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
        </div>
        <Scanner onCode={onCode} paused={!order} />
        <LastScan last={last} />
      </div>
      <Card>
        <CardTitle>Going to the kitchen</CardTitle>
        {!order ? <p className="px-5 pb-5 text-sm text-text-muted">Choose the event, then scan each bag or box as it leaves the store. Change the quantity when only part of a bag goes.</p> : entries.length === 0 ? <p className="px-5 pb-5 text-sm text-text-muted">Scan the first bag.</p> : (
          <>
            <ul className="tnum divide-y">
              {ingIds.map((id) => {
                const ing = ingredients.find((i) => i.id === id);
                const now = entries.filter((e) => e.label.itemId === id).reduce((s, e) => s + e.qty, 0);
                const required = need.get(id) ?? 0;
                const before = issuedBefore(id);
                return (
                  <li key={id} className="space-y-2 px-4 py-3 md:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{ing?.name}</span>
                      <span className="text-sm text-text-muted">{required ? <>needs <span className="font-semibold text-text">{fmtQty(required)} {ing?.unit}</span>{before ? `, ${fmtQty(before)} already issued` : ""}</> : "not in this event's recipes"}</span>
                    </div>
                    {entries.filter((e) => e.label.itemId === id).map((e) => (
                      <div key={e.label.id} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs font-semibold">{e.label.code}</span>
                        <span className="flex-1 text-xs text-text-muted">bag has {fmtQty(e.label.remaining)} {ing?.unit}</span>
                        <Num aria-label={`Quantity from ${e.label.code}`} className="h-9 w-24" value={e.qty} onChange={(v) => setEntries((list) => list.map((x) => (x.label.id === e.label.id ? { ...x, qty: Math.min(v, x.label.remaining) } : x)))} />
                        <Button variant="ghost" size="icon" aria-label={`Remove ${e.label.code}`} onClick={() => setEntries((list) => list.filter((x) => x.label.id !== e.label.id))}><Trash2 strokeWidth={1.75} /></Button>
                      </div>
                    ))}
                    {required > 0 && <p className={cn("text-xs", before + now >= required ? "text-success" : "text-warning")}>{before + now >= required ? `Covered: ${fmtQty(before + now)} of ${fmtQty(required)} ${ing?.unit}` : `${fmtQty(required - before - now)} ${ing?.unit} still to issue`}</p>}
                  </li>
                );
              })}
            </ul>
            <div className="border-t p-4 md:p-5"><Button variant="primary" size="lg" className="w-full" disabled={!store} onClick={finish}><CheckCircle2 strokeWidth={1.75} />Issue {entries.length} {entries.length === 1 ? "bag" : "bags"}</Button></div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ---------- stock count ---------- */

function Count() {
  const labels = useLabels((s) => s.labels);
  const applyCount = useLabels((s) => s.applyCount);
  const { stores, movements, ingredients, assets } = useSupply();
  const text = useLabelText();
  const { last, setLast, lookup } = useScanLog();
  const [scanned, setScanned] = React.useState<StockLabel[]>([]);
  const [storeId, setStoreId] = React.useState("");
  const [markLost, setMarkLost] = React.useState(false);
  const store = storeId || stores[0]?.id || "";
  const onCode = async (raw: string): Promise<ScanResult> => {
    const label = await lookup(raw);
    if (!label) return "bad";
    if (scanned.some((s) => s.id === label.id)) { setLast({ tone: "repeat", text: `${label.code} already counted` }); return "repeat"; }
    if (label.status !== "in_store") { setLast({ tone: "bad", text: `${label.code} should be ${statusLabel[label.status].toLowerCase()}; check it` }); return "bad"; }
    setScanned((s) => [label, ...s]);
    setLast({ tone: "ok", text: `${label.code} ${text(label).name}` });
    return "ok";
  };
  const inStore = labels.filter((l) => l.status === "in_store");
  const items = [...new Set(inStore.map((l) => l.itemId))].map((id) => {
    const expected = inStore.filter((l) => l.itemId === id);
    const seen = scanned.filter((l) => l.itemId === id);
    const kind = expected[0].kind;
    const amount = (list: StockLabel[]) => list.reduce((s, l) => s + l.remaining, 0);
    const book = kind === "ingredient" ? movements.filter((m) => m.ingredientId === id && (!store || m.storeId === store)).reduce((s, m) => s + m.qty, 0) : undefined;
    return { id, kind, name: kind === "asset" ? assets.find((a) => a.id === id)?.name : ingredients.find((i) => i.id === id)?.name, unit: kind === "asset" ? "pcs" : ingredients.find((i) => i.id === id)?.unit, labels: expected.length, seen: seen.length, counted: amount(seen), expected: amount(expected), book };
  });
  const apply = () => {
    const r = applyCount(store, scanned, markLost);
    toast.success("Stock count saved", { description: `${r.adjusted} raw materials corrected${r.lost ? `, ${r.lost} labels marked lost` : ""}.` });
    setScanned([]);
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div className="space-y-3">
        {stores.length > 1 && <Field label="Store being counted"><Select value={store} onChange={(e) => setStoreId(e.target.value)}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
        <Scanner onCode={onCode} />
        <LastScan last={last} />
      </div>
      <Card>
        <CardTitle action={<span className="tnum text-sm text-text-muted">{scanned.length} of {inStore.length} labels</span>}>Count</CardTitle>
        {items.length === 0 ? <p className="px-5 pb-5 text-sm text-text-muted">No labels are in store yet.</p> : (
          <>
            <ul className="tnum divide-y">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm md:px-5">
                  <span className="min-w-0"><span className="block font-medium">{i.name}</span><span className="block text-xs text-text-muted">{i.seen} of {i.labels} labels{i.book !== undefined ? ` · books say ${fmtQty(i.book)} ${i.unit}` : ""}</span></span>
                  <span className={cn("shrink-0 font-semibold", i.seen === i.labels ? "text-success" : i.seen ? "text-warning" : "text-text-muted")}>{fmtQty(i.counted)} <span className="font-normal text-text-muted">of {fmtQty(i.expected)} {i.unit}</span></span>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t p-4 md:p-5">
              <ToggleRow checked={markLost} onCheckedChange={setMarkLost} label="Mark labels not found as lost" help="Only when the whole store has been counted." />
              <p className="text-xs text-text-muted">Saving sets each labelled raw material&apos;s stock to what was scanned. Cutlery totals are shown for checking only.</p>
              <Button variant="primary" size="lg" className="w-full" disabled={!scanned.length} onClick={apply}><CheckCircle2 strokeWidth={1.75} />Save the count</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default function ScanPage() {
  const ready = useLabels((s) => s.ready);
  const [mode, setMode] = React.useState<Mode>("load");
  if (!ready) return (<><PageHeader title="Scan" /><EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0011_labels.sql in the Supabase SQL editor, then reload this page." /></>);
  return (
    <>
      <PageHeader title="Scan" subtitle="Scan labels with the phone camera; counts and stock update as you go." action={<Button variant="ghost" asChild><Link href="/labels">QR labels</Link></Button>} />
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:px-0">
        {modes.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={cn("flex min-w-36 shrink-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors", mode === m.id ? "border-primary bg-primary-soft text-primary" : "bg-surface hover:border-text-muted/40")}>
            <m.icon className="size-6 shrink-0" strokeWidth={1.75} />
            <span><span className="block text-sm font-semibold">{m.label}</span><span className="block text-xs text-text-muted">{m.help}</span></span>
          </button>
        ))}
      </div>
      {mode === "load" && <Cutlery key="load" direction="load" />}
      {mode === "return" && <Cutlery key="return" direction="return" />}
      {mode === "issue" && <Issue />}
      {mode === "count" && <Count />}
      {mode === "receive" && (
        <Card className="mx-auto max-w-xl p-6 text-center">
          <PackagePlus className="mx-auto size-10 text-primary" strokeWidth={1.5} />
          <h2 className="mt-3 font-heading text-lg font-semibold">Receive and label a delivery</h2>
          <p className="mt-1 text-sm text-text-muted">When bags arrive, make a label for each one with &quot;This is a new delivery&quot; switched on. The stock goes up by every bag, and from then on each bag is issued to the kitchen by scanning it.</p>
          <Button variant="primary" className="mt-4" asChild><Link href="/labels">Make labels for the delivery</Link></Button>
          <p className="mt-3 text-xs text-text-muted">Bought against a purchase order? Receive it on the purchase order too, so the order shows as delivered. <Badge>Tip</Badge></p>
        </Card>
      )}
    </>
  );
}
