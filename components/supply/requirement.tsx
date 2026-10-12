"use client";

import { AlertTriangle, CheckCircle2, Printer, ShoppingCart, TrendingDown } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { fmtQty, missingRecipes, onOrder, requirementFor, roundQty, vendorsFor } from "@/lib/supply";
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
}

/**
 * Raw material requirement for a set of functions, and the purchase list that follows from it:
 * requirement minus stock and minus what is already on order, split by the cheapest vendor.
 */
export function Requirement({ functions, orderId, title }: Props) {
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

  const firstDate = functions.map((f) => f.date).sort()[0] ?? "";
  const rows = React.useMemo(() => {
    const need = requirementFor(functions, items, recipes);
    const pending = onOrder(purchaseOrders);
    return ingredients
      .filter((i) => need.has(i.id))
      .map((i) => {
        const required = roundQty(need.get(i.id)!, i.unit);
        const inStock = stock.get(i.id) ?? 0;
        const coming = pending.get(i.id) ?? 0;
        const options = vendorsFor(i.id, vendorRates);
        return { i, required, inStock, coming, short: Math.max(0, roundQty(required - inStock - coming, i.unit)), options };
      });
  }, [functions, items, recipes, ingredients, stock, purchaseOrders, vendorRates]);
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

  return (
    <div className="space-y-4">
      {noRecipe.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="size-4 shrink-0" strokeWidth={1.75} />
          <span>{noRecipe.length} {noRecipe.length === 1 ? "dish has" : "dishes have"} no recipe, so their raw material is not counted: {noRecipe.slice(0, 6).map((i) => i.name).join(", ")}{noRecipe.length > 6 ? " and more" : ""}. Add recipes from the Menu page.</span>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No raw material needed" help="These functions only have outsourced dishes, or their dishes have no recipes yet." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="tnum text-sm text-text-muted">{rows.length} ingredients for {num(functions.reduce((s, f) => s + f.pax, 0))} guests across {functions.length} {functions.length === 1 ? "function" : "functions"}</p>
            <Button onClick={() => setIndent(true)}><Printer strokeWidth={1.75} />Kitchen indent</Button>
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
                            <td className="px-4 py-2 font-medium">{r.i.name}</td>
                            <td className="px-2 py-2 text-right">{fmtQty(r.required)} {r.i.unit}</td>
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
            <Field label="Delivery time"><Input type="time" value={deliverTime} onChange={(e) => setDeliverTime(e.target.value)} /></Field>
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
