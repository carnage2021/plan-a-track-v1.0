"use client";

import { ClipboardList, Plus, Wine } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { EmptyState, MoneyInput, PageHeader } from "@/components/shared/blocks";
import { ChallanBadge } from "@/components/supply/challan";
import { Num, SupplyGate } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { challanLoss } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { Asset, RuleBasis } from "@/lib/supply-types";
import { cn, fmtDate, money, num } from "@/lib/utils";

const categories = ["Crockery", "Cutlery", "Glassware", "Serving", "Kitchen", "Furniture", "Linen", "Other"];
const bases: { id: RuleBasis; label: string }[] = [
  { id: "per_guest", label: "Per guest" },
  { id: "per_dish", label: "Per dish on the menu" },
  { id: "per_function", label: "Fixed number per function" },
  { id: "manual", label: "Entered by hand each time" },
];

function ruleText(a: Asset, categoryName?: string) {
  if (a.ruleBasis === "per_guest") return `${a.ruleValue} per guest`;
  if (a.ruleBasis === "per_dish") return `${a.ruleValue} per ${categoryName ? `${categoryName.toLowerCase()} dish` : "dish"}`;
  if (a.ruleBasis === "per_function") return `${a.ruleValue} per function`;
  return "By hand";
}

function AssetSheet({ asset, onClose }: { asset?: Asset; onClose: () => void }) {
  const menuCategories = useStore((s) => s.categories);
  const saveAsset = useSupply((s) => s.saveAsset);
  const [form, setForm] = React.useState<Omit<Asset, "id">>(() => asset ?? { name: "", category: "Crockery", totalQty: 0, replacementCost: 0, location: "", ruleBasis: "per_guest", ruleValue: 1 });
  const example = form.ruleBasis === "per_guest" ? `300 guests need ${num(Math.ceil(300 * form.ruleValue))}.` : form.ruleBasis === "per_dish" ? `A menu with 5 such dishes needs ${num(Math.ceil(5 * form.ruleValue))}.` : form.ruleBasis === "per_function" ? `Every function gets ${num(Math.ceil(form.ruleValue))}.` : "Nothing is added automatically.";
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={asset ? asset.name : "Add item"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!form.name.trim()} onClick={() => { saveAsset({ ...form, name: form.name.trim(), id: asset?.id }); toast.success(asset ? "Item updated" : "Item added"); onClose(); }}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Item" className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dinner plate" /></Field>
        <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Storage location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Godown rack 3" /></Field>
        <Field label="Total you own"><Num className="text-left" value={form.totalQty} onChange={(v) => setForm({ ...form, totalQty: Math.round(v) })} /></Field>
        <Field label="Replacement cost each" hint="Used to value breakage and loss."><MoneyInput value={form.replacementCost} onChange={(v) => setForm({ ...form, replacementCost: v })} /></Field>
        <Field label="How many does an event need?" className="col-span-2"><Select value={form.ruleBasis} onChange={(e) => setForm({ ...form, ruleBasis: e.target.value as RuleBasis })}>{bases.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></Field>
        {form.ruleBasis !== "manual" && <Field label="Quantity" hint={example}><Num className="text-left" value={form.ruleValue} onChange={(v) => setForm({ ...form, ruleValue: v })} /></Field>}
        {form.ruleBasis === "per_dish" && (
          <Field label="Count dishes from"><Select value={form.ruleCategoryId ?? ""} onChange={(e) => setForm({ ...form, ruleCategoryId: e.target.value || undefined })}><option value="">Every category</option>{menuCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        )}
      </div>
    </Sheet>
  );
}

export default function CutleryPage() {
  const { assets, challans } = useSupply();
  const orders = useStore((s) => s.orders);
  const clients = useStore((s) => s.clients);
  const menuCategories = useStore((s) => s.categories);
  const [open, setOpen] = React.useState<string | "new" | null>(null);
  const out = new Map<string, number>();
  for (const c of challans) if (c.status === "issued") for (const l of c.lines) out.set(l.assetId, (out.get(l.assetId) ?? 0) + Math.max(0, l.issued - l.rentedQty));
  const value = assets.reduce((s, a) => s + a.totalQty * a.replacementCost, 0);

  return (
    <>
      <PageHeader title="Cutlery" subtitle="Crockery, serving ware and equipment: what you own, what is out, and what came back." action={<Button variant="primary" onClick={() => setOpen("new")}><Plus strokeWidth={2} /><span className="max-sm:hidden">Add item</span></Button>} />
      <SupplyGate>
        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items"><Wine className="size-5" strokeWidth={1.75} />Items</TabsTrigger>
            <TabsTrigger value="challans"><ClipboardList className="size-5" strokeWidth={1.75} />Challans{challans.some((c) => c.status === "issued") && <span className="tnum rounded-full bg-surface-muted px-1.5 text-xs">{challans.filter((c) => c.status === "issued").length} out</span>}</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            {assets.length === 0 ? (
              <EmptyState icon={Wine} title="No items yet" help="Add plates, spoons, chafing dishes, counters and the rest, with a rule for how many each event needs." action={<Button variant="primary" onClick={() => setOpen("new")}>Add item</Button>} />
            ) : (
              <>
                <p className="tnum mb-2 text-xs text-text-muted">{assets.length} items · replacement value {money(value)}</p>
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-surface-muted text-left text-xs text-text-muted"><tr><th className="px-4 py-3 font-medium">Item</th><th className="px-4 py-3 text-right font-medium">Own</th><th className="px-4 py-3 text-right font-medium">Out now</th><th className="px-4 py-3 font-medium">Requirement rule</th><th className="px-4 py-3 text-right font-medium">Replacement</th></tr></thead>
                    <tbody className="tnum divide-y">
                      {assets.map((a) => (
                        <tr key={a.id} tabIndex={0} onClick={() => setOpen(a.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(a.id)} className="cursor-pointer hover:bg-surface-muted/60">
                          <td className="px-4 py-2.5"><span className="font-medium">{a.name}</span><span className="block text-xs text-text-muted">{a.category}{a.location ? ` · ${a.location}` : ""}</span></td>
                          <td className="px-4 py-2.5 text-right font-medium">{num(a.totalQty)}</td>
                          <td className={cn("px-4 py-2.5 text-right", out.get(a.id) ? "text-primary" : "text-text-muted")}>{out.get(a.id) ? num(out.get(a.id)!) : "–"}</td>
                          <td className="px-4 py-2.5 text-text-muted">{ruleText(a, menuCategories.find((c) => c.id === a.ruleCategoryId)?.name)}</td>
                          <td className="px-4 py-2.5 text-right">{money(a.replacementCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="challans">
            {challans.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No challans yet" help="Open an order, go to its Cutlery tab and press Work out the cutlery. The counts come from the guests and the menu." action={<Button variant="primary" asChild><Link href="/orders">Open orders</Link></Button>} />
            ) : (
              <Card className="divide-y">
                {challans.map((c) => {
                  const order = orders.find((o) => o.id === c.orderId);
                  const fn = order?.functions.find((f) => f.id === c.functionId);
                  const loss = challanLoss(c, assets);
                  return (
                    <Link key={c.id} href={`/orders/${c.orderId}?tab=cutlery`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/60">
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{clients.find((x) => x.id === order?.clientId)?.name} · {fn?.name}</span><span className="tnum block truncate text-xs text-text-muted">{c.number} · {fn ? fmtDate(fn.date, { day: "numeric", month: "short" }) : ""} · {c.lines.length} items</span></span>
                      {loss > 0 && <span className="tnum text-sm text-danger">{money(loss)} loss</span>}
                      <ChallanBadge status={c.status} />
                    </Link>
                  );
                })}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </SupplyGate>
      {open && <AssetSheet key={open} asset={assets.find((a) => a.id === open)} onClose={() => setOpen(null)} />}
    </>
  );
}
