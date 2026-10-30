"use client";

import { AlertTriangle, CheckCircle2, PencilLine, Plus, Printer, RotateCcw, ShoppingCart, Trash2, TrendingDown, Undo2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, TimeInput } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { fmtQty, missingRecipes, onOrder, requirementFor, roundQty, vendorsFor, withOverrides } from "@/lib/supply";
import { useSupply, type PoDraft } from "@/lib/supply-store";
import { sections } from "@/lib/supply-types";
import type { EventFunction } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { cn, fmtDate, money, num } from "@/lib/utils";
import { Num, useStock } from "./common";

interface Props {
  functions: EventFunction[];
  /** Set when the list is for one order, so purchase orders are linked to it */
  orderId?: string;
  /** Shown on the printed indent */
  title: string;
  /** The order's hand changes to the raw material, and how to save them; editing is offered only with both */
  overrides?: Record<string, number>;
  onOverrides?: (overrides: Record<string, number>) => void;
  /** Raw material already worked out by the caller (several orders, each with its own changes); recipes otherwise */
  baseNeed?: Map<string, number>;
}

/**
 * Raw material requirement for a set of functions, and the purchase list that follows from it:
 * requirement minus stock and minus what is already on order, split by the cheapest vendor.
 */
export function Requirement({ functions, orderId, title, overrides, onOverrides, baseNeed }: Props) {
  const items = useStore((s) => s.items);
  const tenantName = useStore((s) => s.tenant.name);
  const { ingredients, recipes, vendors, vendorRates, purchaseOrders } = useSupply();
  const createPos = useSupply((s) => s.createPos);
  const stock = useStock();
  const [buy, setBuy] = React.useState<Record<string, number>>({});
  const [vendorOf, setVendorOf] = React.useState<Record<string, string>>({});
  const [expectedOn, setExpectedOn] = React.useState("");
  const [deliverTime, setDeliverTime] = React.useState("08:00");
  const [deliverPlace, setDeliverPlace] = React.useState("Main kitchen");
  const [indent, setIndent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  /** Changes being made, before Save; null when not editing */
  const [editing, setEditing] = React.useState<Record<string, number> | null>(null);
  const [addId, setAddId] = React.useState("");
  const [addQty, setAddQty] = React.useState(0);

  const firstDate = functions.map((f) => f.date).sort()[0] ?? "";
  const recipeNeed = React.useMemo(() => baseNeed ?? requirementFor(functions, items, recipes), [baseNeed, functions, items, recipes]);
  const rows = React.useMemo(() => {
    const need = withOverrides(recipeNeed, overrides);
    const pending = onOrder(purchaseOrders);
    return ingredients
      .filter((i) => need.has(i.id))
      .map((i) => {
        const required = roundQty(need.get(i.id)!, i.unit);
        const inStock = stock.get(i.id) ?? 0;
        const coming = pending.get(i.id) ?? 0;
        const options = vendorsFor(i.id, vendorRates);
        const recipe = roundQty(recipeNeed.get(i.id) ?? 0, i.unit);
        return { i, required, recipe, changed: overrides?.[i.id] !== undefined, inStock, coming, short: Math.max(0, roundQty(required - inStock - coming, i.unit)), options };
      });
  }, [recipeNeed, overrides, ingredients, stock, purchaseOrders, vendorRates]);
  const changedCount = Object.keys(overrides ?? {}).length;
  const noRecipe = React.useMemo(() => missingRecipes(functions, items, recipes), [functions, items, recipes]);

  const qtyOf = (r: (typeof rows)[number]) => buy[r.i.id] ?? r.short;
  const vendorFor = (r: (typeof rows)[number]) => vendorOf[r.i.id] ?? r.options[0]?.vendorId ?? "";
  const rateOf = (r: (typeof rows)[number]) => r.options.find((o) => o.vendorId === vendorFor(r))?.rate ?? r.i.lastRate;
  const toBuy = rows.filter((r) => qtyOf(r) > 0);
  const unassigned = toBuy.filter((r) => !vendorFor(r)).length;
  const total = toBuy.reduce((s, r) => s + qtyOf(r) * rateOf(r), 0);
  const vendorCount = new Set(toBuy.map(vendorFor).filter(Boolean)).size;
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "";

  const create = async () => {
    const byVendor = new Map<string, PoDraft>();
    for (const r of toBuy) {
      const vendorId = vendorFor(r);
      if (!vendorId) continue;
      const draft = byVendor.get(vendorId) ?? { vendorId, orderId, expectedOn: expectedOn || firstDate, deliverTime, deliverPlace, lines: [] };
      draft.lines.push({ ingredientId: r.i.id, qty: qtyOf(r), rate: rateOf(r) });
      byVendor.set(vendorId, draft);
    }
    setBusy(true);
    try {
      const made = await createPos([...byVendor.values()]);
      setBuy({});
      toast.success(`${made.length} purchase ${made.length === 1 ? "order" : "orders"} created`, { description: made.map((p) => `${p.number} to ${vendorName(p.vendorId)}`).join(", ") });
    } catch (e) {
      toast.error("Purchase orders were not created", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (functions.length === 0) return <EmptyState icon={ShoppingCart} title="No functions in this range" help="Pick dates that include confirmed events to see what they need." />;

  if (editing) {
    // Every ingredient the recipes call for, plus any added by hand, removed ones included so they can come back.
    const ids = new Set([...recipeNeed.keys(), ...Object.keys(editing)]);
    const list = ingredients.filter((i) => ids.has(i.id)).sort((a, b) => sections.findIndex((x) => x.id === a.section) - sections.findIndex((x) => x.id === b.section) || a.name.localeCompare(b.name));
    const setQty = (id: string, qty: number, recipe: number) =>
      setEditing((e) => {
        const next = { ...e };
        if (qty === recipe && recipe > 0) delete next[id];
        else next[id] = qty;
        return next;
      });
    const addable = ingredients.filter((i) => !ids.has(i.id) || editing[i.id] === 0).sort((a, b) => a.name.localeCompare(b.name));
    return (
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div>
            <h3 className="font-heading text-base font-semibold">Edit raw material for this event</h3>
            <p className="text-xs text-text-muted">Changes apply to this order only; the dish recipes stay as they are. The purchase list, indent and event sheet follow this list.</p>
          </div>
          <div className="flex gap-2">
            {Object.keys(editing).length > 0 && <Button variant="ghost" onClick={() => setEditing({})}><RotateCcw strokeWidth={1.75} />Reset to recipe</Button>}
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => { onOverrides!(editing); setEditing(null); toast.success("Raw material saved for this event"); }}>Save</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr><th className="px-4 py-2 font-medium">Ingredient</th><th className="px-2 py-2 text-right font-medium">By recipe</th><th className="w-36 px-2 py-2 text-right font-medium">For this event</th><th className="w-28 px-4 py-2" /></tr>
            </thead>
            <tbody className="tnum divide-y">
              {list.map((i) => {
                const recipe = roundQty(recipeNeed.get(i.id) ?? 0, i.unit);
                const qty = editing[i.id] ?? recipe;
                const removed = editing[i.id] === 0;
                return (
                  <tr key={i.id} className={cn(removed && "text-text-muted line-through", editing[i.id] !== undefined && !removed && "bg-accent-gold/5")}>
                    <td className="px-4 py-2 font-medium">{i.name}<span className="ml-2 text-xs font-normal text-text-muted no-underline">{sections.find((x) => x.id === i.section)?.label}</span></td>
                    <td className="px-2 py-2 text-right text-text-muted">{recipe ? `${fmtQty(recipe)} ${i.unit}` : "Added"}</td>
                    <td className="px-2 py-1">{removed ? <span className="block text-right text-xs">Removed</span> : <span className="flex items-center justify-end gap-1"><Num aria-label={`${i.name} for this event`} value={qty} onChange={(v) => setQty(i.id, v, recipe)} className="w-24" /><span className="w-8 text-xs text-text-muted">{i.unit}</span></span>}</td>
                    <td className="px-4 py-1 text-right">
                      {removed || (editing[i.id] !== undefined && recipe > 0) ? (
                        <Button variant="ghost" size="icon" aria-label={`Back to the recipe for ${i.name}`} title="Back to the recipe" onClick={() => setEditing((e) => { const next = { ...e }; delete next[i.id]; return next; })}><Undo2 strokeWidth={1.75} /></Button>
                      ) : null}
                      {!removed && <Button variant="ghost" size="icon" aria-label={`Remove ${i.name}`} title="Remove from this event" onClick={() => setQty(i.id, 0, -1)}><Trash2 strokeWidth={1.75} /></Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t p-4">
          <Field label="Add an ingredient" className="min-w-56 flex-1">
            <Select value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">Choose from the store list</option>
              {addable.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </Select>
          </Field>
          <Field label="Quantity"><Num aria-label="Quantity to add" value={addQty} onChange={setAddQty} className="w-28" /></Field>
          <Button disabled={!addId || addQty <= 0} onClick={() => { setEditing((e) => ({ ...e, [addId]: addQty })); setAddId(""); setAddQty(0); }}><Plus strokeWidth={1.75} />Add</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {noRecipe.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="size-4 shrink-0" strokeWidth={1.75} />
          <span>{noRecipe.length} {noRecipe.length === 1 ? "dish has" : "dishes have"} no recipe, so their raw material is not counted: {noRecipe.slice(0, 6).map((i) => i.name).join(", ")}{noRecipe.length > 6 ? " and more" : ""}. Add recipes from the Menu page.</span>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No raw material needed" help="These functions only have outsourced dishes, or their dishes have no recipes yet." action={onOverrides && <Button onClick={() => setEditing({ ...overrides })}><Plus strokeWidth={1.75} />Add raw material by hand</Button>} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="tnum text-sm text-text-muted">{rows.length} ingredients for {num(functions.reduce((s, f) => s + f.pax, 0))} guests across {functions.length} {functions.length === 1 ? "function" : "functions"}{changedCount > 0 && <span className="text-accent-gold"> · {changedCount} changed by hand for this event</span>}</p>
            <div className="flex gap-2">
              {onOverrides && <Button onClick={() => setEditing({ ...overrides })}><PencilLine strokeWidth={1.75} />Edit quantities</Button>}
              <Button onClick={() => setIndent(true)}><Printer strokeWidth={1.75} />Kitchen indent</Button>
            </div>
          </div>

          {sections.map((sec) => {
            const inSection = rows.filter((r) => r.i.section === sec.id);
            if (!inSection.length) return null;
            return (
              <Card key={sec.id} className="overflow-hidden">
                <h3 className="bg-surface-muted px-4 py-2 text-xs font-medium text-text-muted">{sec.label}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="text-left text-xs text-text-muted">
                      <tr><th className="px-4 py-2 font-medium">Ingredient</th><th className="px-2 py-2 text-right font-medium">Needed</th><th className="px-2 py-2 text-right font-medium">In stock</th><th className="px-2 py-2 text-right font-medium">On order</th><th className="w-24 px-2 py-2 text-right font-medium">To buy</th><th className="px-2 py-2 font-medium">Vendor</th><th className="px-4 py-2 text-right font-medium">Amount</th></tr>
                    </thead>
                    <tbody className="tnum divide-y">
                      {inSection.map((r) => {
                        const chosen = vendorFor(r);
                        const cheapest = r.options[0];
                        const saving = cheapest && chosen && chosen !== cheapest.vendorId ? (rateOf(r) - cheapest.rate) * qtyOf(r) : 0;
                        return (
                          <tr key={r.i.id} className={cn(qtyOf(r) === 0 && "text-text-muted")}>
                            <td className="px-4 py-2 font-medium">{r.i.name}{r.changed && <Badge tone="gold" className="ml-2">{r.recipe ? "changed" : "added"}</Badge>}</td>
                            <td className="px-2 py-2 text-right">{fmtQty(r.required)} {r.i.unit}{r.changed && r.recipe > 0 && <span className="block text-xs text-text-muted">recipe {fmtQty(r.recipe)}</span>}</td>
                            <td className={cn("px-2 py-2 text-right", r.inStock < r.required && "text-warning")}>{fmtQty(r.inStock)}</td>
                            <td className="px-2 py-2 text-right">{r.coming ? fmtQty(r.coming) : "–"}</td>
                            <td className="px-2 py-1"><Num aria-label={`Quantity of ${r.i.name} to buy`} value={qtyOf(r)} onChange={(v) => setBuy((b) => ({ ...b, [r.i.id]: v }))} /></td>
                            <td className="px-2 py-1">
                              {qtyOf(r) > 0 && (
                                <>
                                  <Select aria-label={`Vendor for ${r.i.name}`} value={chosen} onChange={(e) => setVendorOf((v) => ({ ...v, [r.i.id]: e.target.value }))} className={cn("min-w-44", !chosen && "border-warning")}>
                                    {!r.options.length && <option value="">No vendor has a rate</option>}
                                    {r.options.map((o, i) => <option key={o.vendorId} value={o.vendorId}>{vendorName(o.vendorId)} · ₹{o.rate}{i === 0 && r.options.length > 1 ? " (cheapest)" : ""}</option>)}
                                  </Select>
                                  {saving > 0 && <span className="mt-0.5 flex items-center gap-1 text-xs text-warning"><TrendingDown className="size-3.5" strokeWidth={1.75} />{vendorName(cheapest.vendorId)} is {money(saving)} cheaper</span>}
                                </>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">{qtyOf(r) > 0 ? money(qtyOf(r) * rateOf(r)) : "–"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}

          <Card className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <Field label="Deliver by"><Input type="date" value={expectedOn || firstDate} onChange={(e) => setExpectedOn(e.target.value)} /></Field>
            <Field label="Delivery time"><TimeInput label="Delivery time" value={deliverTime} onChange={setDeliverTime} /></Field>
            <Field label="Delivery place"><Input value={deliverPlace} onChange={(e) => setDeliverPlace(e.target.value)} /></Field>
            <div className="md:text-right">
              <p className="tnum text-xs text-text-muted">{toBuy.length} items · {money(total)}</p>
              {toBuy.length === 0 ? (
                <p className="flex h-11 items-center gap-1.5 text-sm text-success md:h-9"><CheckCircle2 className="size-4" strokeWidth={1.75} />Stock covers everything</p>
              ) : (
                <Button variant="primary" loading={busy} disabled={vendorCount === 0} onClick={create}><ShoppingCart strokeWidth={1.75} />Create {vendorCount} purchase {vendorCount === 1 ? "order" : "orders"}</Button>
              )}
              {unassigned > 0 && <p className="mt-1 text-xs text-warning">{unassigned} {unassigned === 1 ? "item has" : "items have"} no vendor and will be left out. Add a rate on the Vendors page.</p>}
            </div>
          </Card>
        </>
      )}

      <Sheet open={indent} onOpenChange={setIndent} title="Kitchen indent" description="Raw material to draw from the store, by section." wide footer={<Button onClick={printLight}><Printer strokeWidth={1.75} />Print</Button>}>
        <article className="text-sm">
          <header className="border-b-2 border-text pb-2">
            <p className="font-heading text-lg font-bold">{tenantName} · Raw material indent</p>
            <p className="tnum text-xs text-text-muted">{title} · {functions.map((f) => `${f.name} ${fmtDate(f.date, { day: "numeric", month: "short" })} (${num(f.pax)})`).join(", ")}</p>
          </header>
          {sections.map((sec) => {
            const inSection = rows.filter((r) => r.i.section === sec.id);
            if (!inSection.length) return null;
            return (
              <section key={sec.id} className="mt-4 break-inside-avoid">
                <h3 className="flex items-center gap-2 font-heading text-base font-semibold">{sec.label}<Badge>{inSection.length}</Badge></h3>
                <table className="tnum mt-1 w-full">
                  <tbody className="divide-y">
                    {inSection.map((r) => <tr key={r.i.id}><td className="py-1.5">{r.i.name}</td><td className="py-1.5 text-right font-medium">{fmtQty(r.required)} {r.i.unit}</td><td className="w-24 py-1.5 text-right text-text-muted">Issued ____</td></tr>)}
                  </tbody>
                </table>
              </section>
            );
          })}
        </article>
      </Sheet>
    </div>
  );
}
