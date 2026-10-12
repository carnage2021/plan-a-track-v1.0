"use client";

import { Plus, Search, Star, Store, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { modeLabel, paymentModes } from "@/components/sales/payment-sheet";
import { Badge } from "@/components/shared/badges";
import { Avatar, EmptyState, MoneyInput, PageHeader } from "@/components/shared/blocks";
import { Num, SupplyGate } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, Chip, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useCurrentUser, useStore } from "@/lib/store";
import { agencyScore, vendorBalance, vendorsFor } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import { vendorTypes, type Vendor, type VendorType } from "@/lib/supply-types";
import type { PaymentMode } from "@/lib/types";
import { cn, fmtDate, isoDate, money } from "@/lib/utils";

const typeLabel = (t: VendorType) => vendorTypes.find((x) => x.id === t)?.label ?? t;

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex" role={onChange ? "radiogroup" : "img"} aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n === value ? 0 : n)} aria-label={`${n} stars`} className={cn("grid place-items-center disabled:cursor-default", onChange ? "size-9" : "size-4")}>
          <Star className={cn(onChange ? "size-5" : "size-3.5", n <= value ? "fill-accent-gold text-accent-gold" : "text-border")} strokeWidth={1.75} />
        </button>
      ))}
    </span>
  );
}

function VendorSheet({ vendor, onClose }: { vendor?: Vendor; onClose: () => void }) {
  const role = useCurrentUser().role;
  const items = useStore((s) => s.items);
  const { ingredients, vendorRates, bills, vendorPayments, purchaseOrders, outsourceOrders } = useSupply();
  const { saveVendor, setVendorRate, addBill, addVendorPayment } = useSupply();
  const [form, setForm] = React.useState<Omit<Vendor, "id">>(() => vendor ?? { name: "", type: "raw_material", phone: "", gstin: "", terms: "", rating: 0, notes: "" });
  const [addRate, setAddRate] = React.useState("");
  const [entry, setEntry] = React.useState<"bill" | "payment" | null>(null);
  const [amount, setAmount] = React.useState(0);
  const [ref, setRef] = React.useState("");
  const [mode, setMode] = React.useState<PaymentMode>("bank");
  const canPay = role === "owner" || role === "accountant";

  const rates = vendor ? vendorRates.filter((r) => r.vendorId === vendor.id) : [];
  const dishes = vendor ? items.filter((i) => i.agencyId === vendor.id) : [];
  const ledger = vendor
    ? [
        ...bills.filter((b) => b.vendorId === vendor.id).map((b) => ({ id: b.id, date: b.date, text: `Bill ${b.billNo || ""} ${b.note}`.trim(), amount: b.amount })),
        ...vendorPayments.filter((p) => p.vendorId === vendor.id).map((p) => ({ id: p.id, date: p.date, text: `Paid by ${modeLabel(p.mode)}${p.note ? ` · ${p.note}` : ""}`, amount: -p.amount })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const balance = vendor ? vendorBalance(vendor.id, bills, vendorPayments) : null;
  const history = vendor ? purchaseOrders.filter((p) => p.vendorId === vendor.id).flatMap((p) => p.lines.filter((l) => l.receivedRate !== null).map((l) => ({ id: l.id, date: p.createdAt, name: ingredients.find((i) => i.id === l.ingredientId)?.name ?? "", rate: l.receivedRate!, ordered: l.rate }))) : [];
  const score = vendor ? agencyScore(vendor.id, outsourceOrders) : null;
  const valid = form.name.trim().length > 0;

  const save = () => {
    saveVendor({ ...form, name: form.name.trim(), id: vendor?.id });
    toast.success(vendor ? "Vendor updated" : "Vendor added");
    onClose();
  };
  const saveEntry = () => {
    if (!vendor || amount <= 0) return;
    if (entry === "bill") addBill({ vendorId: vendor.id, billNo: ref, date: isoDate(new Date()), amount, note: "" });
    else addVendorPayment({ vendorId: vendor.id, amount, mode, date: isoDate(new Date()), note: ref });
    toast.success(entry === "bill" ? "Bill added" : `${money(amount)} paid to ${vendor.name}`);
    setEntry(null);
    setAmount(0);
    setRef("");
  };

  const profile = (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Vendor name" className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jalaram Kirana Stores" /></Field>
      <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VendorType })}>{vendorTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></Field>
      <Field label="Phone"><Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      <Field label="GSTIN"><Input className="uppercase" maxLength={15} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Field>
      <Field label="Payment terms"><Input value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="15 days credit" /></Field>
      <div className="col-span-2"><span className="block text-xs font-medium text-text-muted">Rating</span><Stars value={form.rating} onChange={(rating) => setForm({ ...form, rating })} /></div>
      <Field label="Notes" className="col-span-2"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
    </div>
  );

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={vendor ? vendor.name : "Add vendor"} description={vendor ? typeLabel(vendor.type) : undefined} wide={!!vendor} footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" disabled={!valid} onClick={save}>Save vendor</Button></>}>
      {!vendor ? profile : (
        <Tabs defaultValue="ledger">
          <TabsList>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="rates">{vendor.type === "food_agency" ? "Dishes" : "Rates"}</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Billed", balance!.billed], ["Paid", balance!.paid], [balance!.balance < 0 ? "Advance with vendor" : "Outstanding", Math.abs(balance!.balance)]].map(([text, value]) => (
                <div key={text} className="rounded-xl bg-surface-muted p-3"><p className="text-xs text-text-muted">{text}</p><p className={cn("tnum font-heading text-lg font-bold", text === "Outstanding" && Number(value) > 0 && "text-warning")}>{money(Number(value))}</p></div>
              ))}
            </div>
            {score && <p className="tnum rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-muted">Performance {score.score}/100 · {score.delivered} delivered · {score.issues} with issues</p>}
            {entry ? (
              <div className="space-y-3 rounded-xl border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label={entry === "bill" ? "Bill amount" : "Amount paid"}><MoneyInput autoFocus value={amount} onChange={setAmount} /></Field>
                  <Field label={entry === "bill" ? "Bill number" : "Reference"}><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
                  {entry === "payment" && <Field label="Mode" className="col-span-2"><Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>{paymentModes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>}
                </div>
                {entry === "payment" && balance!.balance <= 0 && <p className="text-xs text-text-muted">Nothing is outstanding, so this is recorded as an advance and adjusts against the next bill.</p>}
                <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEntry(null)}>Cancel</Button><Button variant="primary" disabled={amount <= 0} onClick={saveEntry}>Save</Button></div>
              </div>
            ) : (
              <div className="flex gap-2"><Button onClick={() => setEntry("bill")}><Plus strokeWidth={1.75} />Bill</Button>{canPay && <Button onClick={() => { setAmount(Math.max(0, balance!.balance)); setEntry("payment"); }}><Plus strokeWidth={1.75} />Payment or advance</Button>}</div>
            )}
            {ledger.length === 0 ? <p className="py-4 text-center text-sm text-text-muted">No bills or payments yet.</p> : (
              <ul className="tnum divide-y text-sm">
                {ledger.map((l) => <li key={l.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0"><span className="block truncate">{l.text}</span><span className="block text-xs text-text-muted">{fmtDate(l.date)}</span></span><span className={cn("shrink-0 font-medium", l.amount < 0 && "text-success")}>{l.amount < 0 ? "-" : ""}{money(Math.abs(l.amount))}</span></li>)}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="rates" className="space-y-3">
            {vendor.type === "food_agency" ? (
              dishes.length === 0 ? <p className="text-sm text-text-muted">No dishes are mapped to this agency. Open an outsourced dish on the Menu page and choose this agency.</p> : (
                <ul className="tnum divide-y text-sm">{dishes.map((d) => <li key={d.id} className="flex justify-between gap-3 py-2"><span>{d.name}</span><span className="text-text-muted">Agency {money(d.agencyRate)} · client {money(d.price)} · <span className="text-success">{money(d.price - d.agencyRate)} margin</span></span></li>)}</ul>
              )
            ) : (
              <>
                <div className="flex gap-2">
                  <Select aria-label="Add an item this vendor supplies" value={addRate} onChange={(e) => setAddRate(e.target.value)}>
                    <option value="">Add an item this vendor supplies</option>
                    {ingredients.filter((i) => !rates.some((r) => r.ingredientId === i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </Select>
                  <Button disabled={!addRate} onClick={() => { setVendorRate(vendor.id, addRate, ingredients.find((i) => i.id === addRate)?.lastRate || 1); setAddRate(""); }}><Plus strokeWidth={1.75} />Add</Button>
                </div>
                <ul className="divide-y text-sm">
                  {rates.map((r) => {
                    const ingredient = ingredients.find((i) => i.id === r.ingredientId);
                    const best = vendorsFor(r.ingredientId, vendorRates)[0];
                    return (
                      <li key={r.ingredientId} className="flex items-center gap-2 py-1.5">
                        <span className="min-w-0 flex-1 truncate">{ingredient?.name}{best?.vendorId === vendor.id && vendorsFor(r.ingredientId, vendorRates).length > 1 && <Badge tone="success" className="ml-2">Cheapest</Badge>}</span>
                        <span className="text-xs text-text-muted">₹ per {ingredient?.unit}</span>
                        <Num aria-label={`Rate for ${ingredient?.name}`} className="w-24" value={r.rate} onChange={(v) => v > 0 && setVendorRate(vendor.id, r.ingredientId, v)} />
                        <Button variant="ghost" size="icon" aria-label={`Remove ${ingredient?.name}`} onClick={() => setVendorRate(vendor.id, r.ingredientId, null)}><Trash2 strokeWidth={1.75} /></Button>
                      </li>
                    );
                  })}
                </ul>
                {history.length > 0 && (
                  <div>
                    <h3 className="font-heading text-base font-semibold">Rate history</h3>
                    <ul className="tnum mt-1 divide-y text-sm">{history.slice(0, 20).map((h) => <li key={h.id} className="flex justify-between gap-3 py-1.5"><span>{h.name}<span className="ml-2 text-xs text-text-muted">{fmtDate(h.date, { day: "numeric", month: "short" })}</span></span><span className={cn(h.rate > h.ordered && "text-warning")}>{money(h.rate)}{h.rate !== h.ordered ? ` (ordered at ${money(h.ordered)})` : ""}</span></li>)}</ul>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="profile">{profile}</TabsContent>
        </Tabs>
      )}
    </Sheet>
  );
}

export default function VendorsPage() {
  const { vendors, bills, vendorPayments, outsourceOrders, vendorRates } = useSupply();
  const items = useStore((s) => s.items);
  const dishCount = (id: string) => items.filter((i) => i.agencyId === id).length;
  const [type, setType] = React.useState<VendorType | "all">("all");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState<string | "new" | null>(null);
  const shown = vendors.filter((v) => (type === "all" || v.type === type) && (!query.trim() || v.name.toLowerCase().includes(query.trim().toLowerCase())));
  const current = vendors.find((v) => v.id === open);

  return (
    <>
      <PageHeader title="Vendors" subtitle="Suppliers, third-party food agencies, rentals and transport, with what you owe each." action={<Button variant="primary" onClick={() => setOpen("new")}><Plus strokeWidth={2} /><span className="max-sm:hidden">Add vendor</span></Button>} />
      <SupplyGate>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
          <span className="sr-only">Search vendors</span>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vendors" className="bg-surface pl-10" />
        </label>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <Chip active={type === "all"} onClick={() => setType("all")}>All<span className="tnum text-xs">{vendors.length}</span></Chip>
          {vendorTypes.filter((t) => vendors.some((v) => v.type === t.id)).map((t) => <Chip key={t.id} active={type === t.id} onClick={() => setType(t.id)}>{t.label}</Chip>)}
        </div>
        {shown.length === 0 ? (
          <div className="mt-4"><EmptyState icon={Store} title="No vendors here" help="Add the people you buy from and outsource to." action={<Button variant="primary" onClick={() => setOpen("new")}>Add vendor</Button>} /></div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((v) => {
              const bal = vendorBalance(v.id, bills, vendorPayments).balance;
              const score = agencyScore(v.id, outsourceOrders);
              const supplies = v.type === "food_agency" ? dishCount(v.id) : vendorRates.filter((r) => r.vendorId === v.id).length;
              return (
                <Card key={v.id} className="p-0">
                  <button type="button" onClick={() => setOpen(v.id)} className="flex w-full items-start gap-3 rounded-xl p-4 text-left hover:bg-surface-muted/40">
                    <Avatar name={v.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-base font-semibold">{v.name}</span>
                      <span className="tnum block truncate text-xs text-text-muted">{typeLabel(v.type)}{v.phone ? ` · ${v.phone}` : ""}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2"><Stars value={v.rating} />{supplies > 0 && <Badge>{supplies} {v.type === "food_agency" ? "dishes" : "items"}</Badge>}{score && <Badge tone={score.score >= 80 ? "success" : "warning"}>{score.score}/100 on time</Badge>}</span>
                    </span>
                    <span className="tnum shrink-0 text-right text-sm"><span className={cn("block font-semibold", bal > 0 && "text-warning")}>{bal === 0 ? "Settled" : money(Math.abs(bal))}</span>{bal !== 0 && <span className="block text-xs text-text-muted">{bal > 0 ? "to pay" : "advance"}</span>}</span>
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </SupplyGate>
      {open && <VendorSheet key={open} vendor={current} onClose={() => setOpen(null)} />}
    </>
  );
}
