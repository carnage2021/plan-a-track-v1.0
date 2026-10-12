"use client";

import { Boxes, ListChecks, ShoppingCart } from "lucide-react";
import * as React from "react";
import { PageHeader } from "@/components/shared/blocks";
import { SupplyGate } from "@/components/supply/common";
import { PoTab } from "@/components/supply/po";
import { Requirement } from "@/components/supply/requirement";
import { StockTab } from "@/components/supply/stock";
import { Field, Input } from "@/components/ui/input";
import { Card, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import { addDays, fmtDate, isoDate } from "@/lib/utils";

function PurchaseList() {
  const orders = useStore((s) => s.orders);
  const [from, setFrom] = React.useState(() => isoDate(new Date()));
  const [to, setTo] = React.useState(() => isoDate(addDays(new Date(), 14)));
  const [tentative, setTentative] = React.useState(false);
  const functions = React.useMemo(
    () =>
      orders
        .filter((o) => o.status === "confirmed" || o.status === "in_progress" || (tentative && o.status === "tentative"))
        .flatMap((o) => o.functions)
        .filter((f) => f.date >= from && f.date <= to),
    [orders, from, to, tentative],
  );
  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 items-end gap-3 p-4 md:grid-cols-[auto_auto_1fr]">
        <Field label="Events from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        <label className="col-span-2 flex items-center gap-3 text-sm md:col-span-1 md:justify-end">Include tentative orders<Switch checked={tentative} onCheckedChange={setTentative} label="Include tentative orders" /></label>
      </Card>
      <Requirement functions={functions} title={`${fmtDate(from, { day: "numeric", month: "short" })} to ${fmtDate(to, { day: "numeric", month: "short" })}`} />
    </div>
  );
}

export default function PurchasePage() {
  const openPos = useSupply((s) => s.purchaseOrders.filter((p) => ["draft", "sent", "partial"].includes(p.status)).length);
  return (
    <>
      <PageHeader title="Purchase and Stock" subtitle="What the coming events need, what is in the store, and what is on order." />
      <SupplyGate>
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list"><ListChecks className="size-5" strokeWidth={1.75} />Purchase list</TabsTrigger>
            <TabsTrigger value="stock"><Boxes className="size-5" strokeWidth={1.75} />Stock</TabsTrigger>
            <TabsTrigger value="orders"><ShoppingCart className="size-5" strokeWidth={1.75} />Purchase orders{openPos > 0 && <span className="tnum rounded-full bg-surface-muted px-1.5 text-xs">{openPos}</span>}</TabsTrigger>
          </TabsList>
          <TabsContent value="list"><PurchaseList /></TabsContent>
          <TabsContent value="stock"><StockTab /></TabsContent>
          <TabsContent value="orders"><PoTab /></TabsContent>
        </Tabs>
      </SupplyGate>
    </>
  );
}
