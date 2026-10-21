"use client";

import { Boxes, DatabaseZap, Package, Printer, QrCode, ScanLine, Search, Wheat } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { LabelSheet, useLabelText } from "@/components/labels/label-sheet";
import { Badge } from "@/components/shared/badges";
import { EmptyState, MoneyInput, PageHeader } from "@/components/shared/blocks";
import { Num } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, CardTitle, Chip, ToggleRow } from "@/components/ui/primitives";
import { statusLabel, useLabels, type LabelKind, type LabelStatus, type StockLabel } from "@/lib/labels";
import { useSupply } from "@/lib/supply-store";
import { cn, fmtDate, localDay, num } from "@/lib/utils";

const tone: Record<LabelStatus, "success" | "primary" | "neutral" | "danger"> = { in_store: "success", out: "primary", used: "neutral", lost: "danger" };

function CreateLabels({ onMade }: { onMade: (labels: StockLabel[]) => void }) {
  const { assets, ingredients, stores } = useSupply();
  const create = useLabels((s) => s.create);
  const [kind, setKind] = React.useState<LabelKind>("asset");
  const [itemId, setItemId] = React.useState("");
  const [single, setSingle] = React.useState(false);
  const [qty, setQty] = React.useState(50);
  const [count, setCount] = React.useState(10);
  const [note, setNote] = React.useState("");
  const [receive, setReceive] = React.useState(true);
  const [storeId, setStoreId] = React.useState("");
  const [rate, setRate] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const items = kind === "asset" ? assets.map((a) => ({ id: a.id, name: a.name, unit: "pieces" })) : ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit }));
  const item = items.find((i) => i.id === itemId);
  const ing = ingredients.find((i) => i.id === itemId);
  const per = single ? 1 : qty;
  const store = storeId || stores[0]?.id || "";

  const switchKind = (k: LabelKind) => { setKind(k); setItemId(""); setSingle(false); setQty(k === "asset" ? 50 : 25); };
  const pickItem = (id: string) => { setItemId(id); setRate(ingredients.find((i) => i.id === id)?.lastRate ?? 0); };
  const make = async () => {
    setBusy(true);
    try {
      const made = await create({ kind, itemId, qty: per, single, count, note: note.trim(), receive: kind === "ingredient" && receive && store ? { storeId: store, rate } : undefined });
      toast.success(`${made.length} labels made, ${made[0].code} to ${made[made.length - 1].code}`, { description: kind === "ingredient" && receive ? `${num(per * count)} ${ing?.unit} of ${ing?.name} added to stock` : "Print them and stick one on each bunch." });
      onMade(made);
    } catch (e) {
      toast.error("The labels were not made", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-4 md:p-5">
      <h2 className="font-heading text-lg font-semibold">Make labels</h2>
      <div className="grid grid-cols-2 gap-2">
        {([["asset", "Cutlery and equipment", Boxes], ["ingredient", "Raw material", Wheat]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => switchKind(k)} className={cn("flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-medium", kind === k ? "border-primary bg-primary-soft text-primary" : "bg-surface text-text-muted hover:text-text")}><Icon className="size-5" strokeWidth={1.75} />{label}</button>
        ))}
      </div>
      <Field label={kind === "asset" ? "Item" : "Ingredient"} hint={items.length ? undefined : kind === "asset" ? "Add cutlery and equipment on the Cutlery page first." : "Add ingredients on the Purchase and Stock page first."}>
        <Select value={itemId} onChange={(e) => pickItem(e.target.value)}><option value="">Choose</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
      </Field>
      {kind === "asset" && (
        <div className="flex gap-2">
          <Chip active={!single} onClick={() => setSingle(false)}>A bunch or crate</Chip>
          <Chip active={single} onClick={() => setSingle(true)}>Single piece</Chip>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {!single && <Field label={kind === "asset" ? "Pieces in each bunch" : `Each bag holds (${item?.unit ?? "unit"})`}><Num value={qty} onChange={setQty} /></Field>}
        <Field label="How many labels"><Num value={count} onChange={(v) => setCount(Math.min(500, v))} /></Field>
      </div>
      <Field label="Note on the label (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "asset" ? "Rack 3" : "Batch 12 Oct"} /></Field>
      {kind === "ingredient" && (
        <div className="space-y-3 rounded-xl border p-3">
          <ToggleRow checked={receive} onCheckedChange={setReceive} label="This is a new delivery" help="Adds the bags to stock. Switch off when labelling stock you already have." />
          {receive && (
            <div className="grid grid-cols-2 gap-3">
              {stores.length > 1 && <Field label="Into store"><Select value={store} onChange={(e) => setStoreId(e.target.value)}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
              <Field label={`Rate per ${ing?.unit ?? "unit"}`}><MoneyInput value={rate} onChange={setRate} /></Field>
            </div>
          )}
        </div>
      )}
      {item && per > 0 && count > 0 && (
        <p className="rounded-lg bg-surface-muted p-3 text-sm">
          {count} {count === 1 ? "label" : "labels"} for <span className="font-medium">{item.name}</span>{single ? ", one per piece" : `, ${num(per)} ${item.unit} each`}: <span className="font-semibold">{num(per * count)} {item.unit}</span> in all.
          {kind === "ingredient" && receive && " This much is added to stock."}
        </p>
      )}
      <Button variant="primary" size="lg" className="w-full" loading={busy} disabled={!itemId || per <= 0 || count <= 0 || (kind === "ingredient" && receive && !store)} onClick={make}><QrCode strokeWidth={1.75} />Make and print labels</Button>
    </Card>
  );
}

export default function LabelsPage() {
  const ready = useLabels((s) => s.ready);
  const labels = useLabels((s) => s.labels);
  const markLost = useLabels((s) => s.markLost);
  const { assets, ingredients, challans } = useSupply();
  const text = useLabelText();
  const [print, setPrint] = React.useState<StockLabel[] | null>(null);
  const [kind, setKind] = React.useState<LabelKind | "all">("all");
  const [status, setStatus] = React.useState<LabelStatus | "all">("all");
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  const shown = labels.filter((l) => (kind === "all" || l.kind === kind) && (status === "all" || l.status === status) && `${l.code} ${text(l).name}`.toLowerCase().includes(q.toLowerCase()));
  // What the labels add up to per item: how much is in store, out at events, used or lost.
  const totals = React.useMemo(() => {
    const map = new Map<string, { name: string; unit: string; in_store: number; out: number; used: number; lost: number; labels: number }>();
    for (const l of labels) {
      const name = l.kind === "asset" ? assets.find((a) => a.id === l.itemId)?.name : ingredients.find((i) => i.id === l.itemId)?.name;
      const unit = l.kind === "asset" ? "pcs" : (ingredients.find((i) => i.id === l.itemId)?.unit ?? "");
      const row = map.get(l.itemId) ?? { name: name ?? "Item", unit, in_store: 0, out: 0, used: 0, lost: 0, labels: 0 };
      row[l.status] += l.status === "used" ? l.qty : l.remaining;
      row.labels += 1;
      map.set(l.itemId, row);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [labels, assets, ingredients]);

  if (!ready) return (<><PageHeader title="QR labels" /><EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0011_labels.sql in the Supabase SQL editor, then reload this page. It adds QR labels and scanning." /></>);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <PageHeader title="QR labels" subtitle="Label every bunch, piece and bag once; after that, scanning does the counting." action={<Button variant="primary" asChild><Link href="/scan"><ScanLine strokeWidth={1.75} />Scan</Link></Button>} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:items-start">
        <CreateLabels onMade={(made) => setPrint(made)} />
        <div className="min-w-0 space-y-4">
          {totals.length > 0 && (
            <Card>
              <CardTitle>What the labels add up to</CardTitle>
              <div className="overflow-x-auto">
                <table className="tnum w-full min-w-[520px] text-left text-sm">
                  <thead className="border-y bg-surface-muted/50 text-xs text-text-muted"><tr><th className="px-4 py-2 font-medium md:px-5">Item</th><th className="py-2 text-right font-medium">Labels</th><th className="py-2 text-right font-medium">In store</th><th className="py-2 text-right font-medium">Out at events</th><th className="py-2 text-right font-medium">Used</th><th className="px-4 py-2 text-right font-medium md:px-5">Lost</th></tr></thead>
                  <tbody className="divide-y">{totals.map((t) => <tr key={t.name}><td className="px-4 py-2 font-medium md:px-5">{t.name}</td><td className="py-2 text-right">{t.labels}</td><td className="py-2 text-right text-success">{num(t.in_store)} {t.unit}</td><td className="py-2 text-right">{t.out ? `${num(t.out)} ${t.unit}` : "-"}</td><td className="py-2 text-right text-text-muted">{t.used ? `${num(t.used)} ${t.unit}` : "-"}</td><td className={cn("px-4 py-2 text-right md:px-5", t.lost && "text-danger")}>{t.lost ? `${num(t.lost)} ${t.unit}` : "-"}</td></tr>)}</tbody>
                </table>
              </div>
            </Card>
          )}
          <Card>
            <div className="flex flex-wrap items-center gap-2 p-4 md:p-5">
              <div className="relative min-w-40 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} /><Input aria-label="Search labels" className="pl-9" placeholder="Code or item" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <Select aria-label="Kind" className="w-auto" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="all">Everything</option><option value="asset">Cutlery and equipment</option><option value="ingredient">Raw material</option></Select>
              <Select aria-label="Status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">Any status</option>{(Object.keys(statusLabel) as LabelStatus[]).map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}</Select>
            </div>
            {picked.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t bg-primary-soft/50 px-4 py-2 text-sm md:px-5">
                <span className="font-medium">{picked.size} selected</span>
                <Button variant="ghost" onClick={() => setPrint(labels.filter((l) => picked.has(l.id)))}><Printer strokeWidth={1.75} />Print again</Button>
                <Button variant="ghost" onClick={() => { markLost([...picked]); setPicked(new Set()); }}>Mark lost</Button>
                <Button variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>
              </div>
            )}
            {shown.length === 0 ? <div className="border-t"><EmptyState icon={Package} title={labels.length ? "No labels match" : "No labels yet"} help="Make labels on the left: one per crate, bunch, single piece or bag. Print them on A4 sticker paper and stick them on." /></div> : (
              <ul className="divide-y border-t">
                {shown.slice(0, 300).map((l) => {
                  const t = text(l);
                  const challan = challans.find((c) => c.id === l.challanId);
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm md:px-5">
                      <input type="checkbox" aria-label={`Select ${l.code}`} className="size-4 accent-[var(--color-primary)]" checked={picked.has(l.id)} onChange={() => toggle(l.id)} />
                      <Link href={`/s/${l.code}`} className="font-mono font-semibold hover:underline">{l.code}</Link>
                      <span className="min-w-0 flex-1"><span className="block truncate">{t.name}</span><span className="block truncate text-xs text-text-muted">{t.size}{challan ? ` · on ${challan.number}` : ""}{l.lastScanAt ? ` · scanned ${fmtDate(localDay(l.lastScanAt), { day: "numeric", month: "short" })}` : ""}</span></span>
                      <Badge tone={tone[l.status]}>{statusLabel[l.status]}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {print && <LabelSheet labels={print} open onOpenChange={(o) => !o && setPrint(null)} />}
    </>
  );
}
