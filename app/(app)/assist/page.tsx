"use client";

import { ArrowRight, ChefHat, MessageSquareText, Scale, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge, VegMark } from "@/components/shared/badges";
import { MoneyInput, PageHeader, PaxInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, Chip, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { blankDraft, blankFunction } from "@/lib/draft";
import { kitchenKey, portions, useKitchen } from "@/lib/kitchen";
import { priceFunction } from "@/lib/pricing";
import { offered } from "@/lib/packages";
import { useCurrentUser, useStore } from "@/lib/store";
import type { Diet, MenuItem } from "@/lib/types";
import { cn, isoDate, money, num } from "@/lib/utils";

// Phase 7 (plan F4): helpers that work from the caterer's own data with plain rules, so they need no
// outside service and cost nothing to run. An AI model can replace the text reader later without changing the screens.

/* ---------- menu suggestion ---------- */

function useSuggestion(pax: number, budget: number, diet: "any" | "veg" | "jain") {
  const { items, packages, categories, orders, tenant } = useStore();
  return React.useMemo(() => {
    const fits = (i: MenuItem) => i.active && (diet === "any" || (diet === "veg" ? i.diet !== "nonveg" : i.diet === "jain"));
    // Popularity: how many booked functions each dish has been on, with bestsellers first.
    const used = new Map<string, number>();
    for (const o of orders) if (o.status !== "cancelled") for (const f of o.functions) for (const id of f.itemIds) used.set(id, (used.get(id) ?? 0) + 1);
    const rank = (a: MenuItem, b: MenuItem) => Number(b.bestseller) - Number(a.bestseller) || (used.get(b.id) ?? 0) - (used.get(a.id) ?? 0) || a.price - b.price;
    const pkg = offered(packages).filter((p) => p.pricePerPlate <= budget && p.minPax <= pax).sort((a, b) => b.pricePerPlate - a.pricePerPlate)[0];
    let ids: string[];
    if (pkg) {
      ids = pkg.fixedItemIds.filter((id) => items.some((i) => i.id === id && fits(i)));
      for (const r of pkg.rules) ids.push(...items.filter((i) => i.categoryId === r.categoryId && fits(i) && i.pricingType === "plate" && !ids.includes(i.id)).sort(rank).slice(0, r.choose).map((i) => i.id));
    } else {
      // No package fits the budget: take the best dish from each category while the plate stays within it.
      ids = [];
      for (const c of categories) {
        const best = items.filter((i) => i.categoryId === c.id && fits(i) && i.pricingType === "plate").sort(rank)[0];
        if (best && priceFunction({ pax, itemIds: [...ids, best.id] }, items, packages, tenant.slabs).perPlate <= budget) ids.push(best.id);
      }
    }
    const price = priceFunction({ pax, packageId: pkg?.id, itemIds: ids }, items, packages, tenant.slabs);
    return { pkg, ids, perPlate: price.perPlate, total: price.total };
  }, [items, packages, categories, orders, tenant.slabs, pax, budget, diet]);
}

function MenuSuggest() {
  const router = useRouter();
  const { items, categories } = useStore();
  const saveDraft = useStore((s) => s.saveDraft);
  const [pax, setPax] = React.useState(300);
  const [budget, setBudget] = React.useState(650);
  const [diet, setDiet] = React.useState<"any" | "veg" | "jain">("veg");
  const [eventType, setEventType] = React.useState("Wedding");
  const s = useSuggestion(pax, budget, diet);
  const start = () => {
    const fn = { ...blankFunction(eventType, "", pax), packageId: s.pkg?.id, itemIds: s.ids };
    saveDraft("builder", { ...blankDraft(), eventType, functions: [fn], step: 0 });
    router.push("/quotations/new");
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
      <Card className="space-y-4 p-4 md:p-5">
        <Field label="Event"><Input value={eventType} onChange={(e) => setEventType(e.target.value)} /></Field>
        <Field label="Guests"><PaxInput value={pax} onChange={setPax} compact /></Field>
        <Field label="Budget per plate"><MoneyInput value={budget} onChange={setBudget} /></Field>
        <div><span className="mb-1 block text-xs font-medium text-text-muted">Food</span><div className="flex gap-2">{(["veg", "jain", "any"] as const).map((d) => <Chip key={d} active={diet === d} onClick={() => setDiet(d)}>{d === "veg" ? "Veg" : d === "jain" ? "Jain" : "Any"}</Chip>)}</div></div>
      </Card>
      <Card className="p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-text-muted">{s.pkg ? `Built on the ${s.pkg.name} package` : "No package fits this budget, so dishes are picked one by one"}</p>
            <p className="tnum font-heading text-2xl font-bold">{money(s.perPlate)} <span className="text-base font-normal text-text-muted">per plate</span></p>
            <p className="tnum text-sm text-text-muted">{money(s.total)} for {num(pax)} guests, before GST{s.perPlate > budget && <Badge tone="warning" className="ml-2">Over budget</Badge>}</p>
          </div>
          <Button variant="primary" disabled={!s.ids.length} onClick={start}>Start a quotation<ArrowRight strokeWidth={1.75} /></Button>
        </div>
        {s.ids.length === 0 ? <p className="mt-6 text-sm text-text-muted">Nothing on the menu matches yet. Add dishes, or relax the food choice.</p> : (
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {categories.map((c) => {
              const list = s.ids.map((id) => items.find((i) => i.id === id)).filter((i): i is MenuItem => !!i && i.categoryId === c.id);
              if (!list.length) return null;
              return <div key={c.id}><p className="text-xs font-medium uppercase tracking-wide text-text-muted">{c.name}</p><ul className="mt-1 space-y-1">{list.map((i) => <li key={i.id} className="flex items-center gap-2 text-sm"><VegMark diet={i.diet} />{i.name}{i.bestseller && <Badge tone="gold">Bestseller</Badge>}</li>)}</ul></div>;
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-text-muted">Picks the richest package within budget, then fills each choice with your bestsellers and most booked dishes.</p>
      </Card>
    </div>
  );
}

/* ---------- quantity prediction ---------- */

function Quantities() {
  const { orders, items } = useStore();
  const patchItems = useStore((s) => s.patchItems);
  const rows = useKitchen((s) => s.rows);
  const ready = useKitchen((s) => s.ready);
  const data = React.useMemo(() => {
    const by = new Map<string, { cooked: number; left: number; pax: number; events: number }>();
    for (const o of orders) for (const f of o.functions) for (const id of f.itemIds) {
      const row = rows[kitchenKey(f.id, id)];
      const item = items.find((i) => i.id === id);
      // Only dishes that were packed and had their leftover counted teach us anything.
      if (!row || row.status !== "packed" || !item || item.pricingType !== "plate") continue;
      const d = by.get(id) ?? { cooked: 0, left: 0, pax: 0, events: 0 };
      by.set(id, { cooked: d.cooked + portions(item, f.pax), left: d.left + row.leftover, pax: d.pax + f.pax, events: d.events + 1 });
    }
    return [...by.entries()].map(([id, d]) => {
      const item = items.find((i) => i.id === id)!;
      const eaten = (d.cooked - d.left) / d.pax;
      // What guests actually ate per head, plus a 3% safety margin, becomes the new buffer.
      const suggested = Math.max(0, Math.min(30, Math.round((eaten - 1) * 100 + 3)));
      return { item, ...d, leftPct: d.cooked ? (d.left / d.cooked) * 100 : 0, suggested };
    }).sort((a, b) => b.leftPct - a.leftPct);
  }, [orders, items, rows]);
  if (!ready || data.length === 0) return <Card className="p-6 text-center text-sm text-text-muted"><Scale className="mx-auto mb-2 size-8" strokeWidth={1.5} />Predictions appear once the kitchen marks dishes packed and enters what was left over after events. The more events, the better the advice.</Card>;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-surface-muted/50 text-xs text-text-muted"><tr><th className="px-4 py-2 font-medium md:px-5">Dish</th><th className="py-2 text-right font-medium">Events</th><th className="py-2 text-right font-medium">Cooked</th><th className="py-2 text-right font-medium">Left over</th><th className="py-2 text-right font-medium">Buffer now</th><th className="py-2 text-right font-medium">Suggested</th><th className="px-4 py-2 md:px-5" /></tr></thead>
          <tbody className="divide-y">
            {data.map((d) => (
              <tr key={d.item.id}>
                <td className="px-4 py-2 font-medium md:px-5">{d.item.name}</td>
                <td className="py-2 text-right">{d.events}</td>
                <td className="py-2 text-right">{num(d.cooked)}</td>
                <td className={cn("py-2 text-right", d.leftPct > 10 && "font-medium text-warning")}>{num(d.left)} ({Math.round(d.leftPct)}%)</td>
                <td className="py-2 text-right">{d.item.bufferPct}%</td>
                <td className="py-2 text-right font-semibold">{d.suggested}%</td>
                <td className="px-4 py-2 text-right md:px-5">{d.suggested !== d.item.bufferPct && <Button variant="ghost" onClick={() => { patchItems([d.item.id], { bufferPct: d.suggested }); toast.success(`${d.item.name} now cooks ${d.suggested}% extra`); }}>Apply</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-3 text-xs text-text-muted md:px-5">The buffer is the extra cooked over the guest count. Suggestions come from what guests actually ate at past events, plus 3% for safety.</p>
    </Card>
  );
}

/* ---------- enquiry from a pasted message ---------- */

const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const events = ["wedding", "reception", "engagement", "sangeet", "haldi", "mehndi", "birthday", "anniversary", "baby shower", "corporate", "conference", "puja", "pooja", "griha pravesh", "house warming", "kitty party", "navratri", "diwali party"];

/** Pulls the event details out of a message the way a person would skim it. */
function readEnquiry(text: string) {
  const t = text.replace(/\s+/g, " ");
  const lower = t.toLowerCase();
  const phone = (t.match(/(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})\b/) ?? [])[1]?.replace(/\D/g, "") ?? "";
  const pax = Number((lower.match(/(\d{2,5})\s*(?:\+\s*)?(?:pax|guests?|people|persons?|members|log|plates?)\b/) ?? [])[1] ?? 0);
  const budget = Number((lower.match(/(?:₹|rs\.?|inr)\s*(\d{2,5})(?:\s*\/?-?\s*(?:per|a|\/)\s*(?:plate|head|pax))/) ?? lower.match(/(\d{2,5})\s*(?:₹|rs\.?)?\s*(?:per|a|\/)\s*(?:plate|head)/) ?? [])[1] ?? 0);
  const event = events.find((e) => lower.includes(e));
  const food: Diet = /\bjain\b/.test(lower) ? "jain" : /non[\s-]?veg/.test(lower) ? "nonveg" : "veg";
  // Dates: 12/11/2026, 12-11-26, 12 Nov, 12th November, Nov 12.
  let date = "";
  const now = new Date();
  const year = (y?: string) => (y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : undefined);
  const make = (d: number, m: number, y?: number) => {
    let dt = new Date(y ?? now.getFullYear(), m, d);
    if (!y && dt < now) dt = new Date(now.getFullYear() + 1, m, d);
    return isoDate(dt);
  };
  const num1 = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  const word1 = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s*(\d{4})?/);
  const word2 = lower.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/);
  if (num1) date = make(Number(num1[1]), Number(num1[2]) - 1, year(num1[3]));
  else if (word1 && months.includes(word1[2])) date = make(Number(word1[1]), months.indexOf(word1[2]), year(word1[3]));
  else if (word2 && months.includes(word2[1])) date = make(Number(word2[2]), months.indexOf(word2[1]), year(word2[3]));
  const venue = (t.match(/\b(?:venue|at|in)\s*[:-]?\s*([A-Z][\w'&]*(?:\s+[A-Z][\w'&]*){0,4})/) ?? [])[1] ?? "";
  const name = (t.match(/\b(?:i am|i'm|this is|name\s*[:-]|myself)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i) ?? [])[1] ?? "";
  return { name, phone, pax, budget, date, venue: venue && !months.includes(venue.slice(0, 3).toLowerCase()) ? venue : "", food, eventType: event ? event.replace(/\b\w/g, (c) => c.toUpperCase()) : "" };
}

function EnquiryReader() {
  const me = useCurrentUser();
  const { ensureClient, saveEnquiry } = useStore();
  const [text, setText] = React.useState("");
  const [f, setF] = React.useState<ReturnType<typeof readEnquiry> | null>(null);
  const [saved, setSaved] = React.useState(false);
  const set = (patch: Partial<ReturnType<typeof readEnquiry>>) => setF((x) => (x ? { ...x, ...patch } : x));
  const create = () => {
    if (!f) return;
    const clientId = ensureClient(f.name.trim() || "New client", f.phone);
    saveEnquiry({ clientId, eventType: f.eventType || "Function", date: f.date, venue: f.venue, pax: f.pax, budgetPerPlate: f.budget, foodPref: f.food, notes: text.trim(), source: "whatsapp", stage: "new", assignedTo: me.id });
    toast.success("Enquiry created", { description: "It is on the Enquiries board under New." });
    setSaved(true);
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <Card className="space-y-3 p-4 md:p-5">
        <Field label="Paste the WhatsApp message"><Textarea rows={8} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} placeholder={"Hi, I am Kavita Joshi. We need catering for my daughter's engagement on 14th December at Karnavati Club, around 250 guests, pure Jain food, budget Rs 600 per plate. Call me on 98250 70044."} /></Field>
        <Button variant="primary" disabled={!text.trim()} onClick={() => { setF(readEnquiry(text)); setSaved(false); }}><Wand2 strokeWidth={1.75} />Read the message</Button>
      </Card>
      {f && (
        <Card className="space-y-3 p-4 md:p-5">
          <p className="text-sm text-text-muted">Check what was found and fix anything before saving.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Mobile" error={f.phone.length !== 10 ? "No 10-digit number found" : ""}><Input inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} /></Field>
            <Field label="Event"><Input value={f.eventType} onChange={(e) => set({ eventType: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
            <Field label="Guests"><Input inputMode="numeric" value={f.pax || ""} onChange={(e) => set({ pax: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
            <Field label="Budget per plate"><MoneyInput value={f.budget} onChange={(budget) => set({ budget })} /></Field>
            <Field label="Venue"><Input value={f.venue} onChange={(e) => set({ venue: e.target.value })} /></Field>
            <Field label="Food"><Select value={f.food} onChange={(e) => set({ food: e.target.value as Diet })}><option value="veg">Veg</option><option value="jain">Jain</option><option value="nonveg">Non-veg</option></Select></Field>
          </div>
          {saved ? <Button variant="ghost" asChild><Link href="/enquiries">Open Enquiries<ArrowRight strokeWidth={1.75} /></Link></Button> : <Button variant="primary" disabled={f.phone.length !== 10 || !f.date} onClick={create}>Create enquiry</Button>}
        </Card>
      )}
    </div>
  );
}

export default function AssistPage() {
  return (
    <>
      <PageHeader title="Smart assist" subtitle="Menu ideas from a budget, cooking quantities that learn from leftovers, and enquiries read from WhatsApp." />
      <Tabs defaultValue="menu">
        <TabsList>
          <TabsTrigger value="menu"><Sparkles className="size-4" strokeWidth={1.75} />Suggest a menu</TabsTrigger>
          <TabsTrigger value="qty"><ChefHat className="size-4" strokeWidth={1.75} />Cooking quantities</TabsTrigger>
          <TabsTrigger value="read"><MessageSquareText className="size-4" strokeWidth={1.75} />Read an enquiry</TabsTrigger>
        </TabsList>
        <TabsContent value="menu"><MenuSuggest /></TabsContent>
        <TabsContent value="qty"><Quantities /></TabsContent>
        <TabsContent value="read"><EnquiryReader /></TabsContent>
      </Tabs>
    </>
  );
}
