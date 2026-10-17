"use client";

import { Minus, Plus, Printer } from "lucide-react";
import * as React from "react";
import { VegMark } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Chip } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import type { MenuItem, Order } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Lang = "both" | "en" | "local";
type Design = "classic" | "brand" | "minimal";

const designs: { id: Design; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "brand", label: "Brand colour" },
  { id: "minimal", label: "Minimal" },
];

/** One folded tent card: the dish name, its local name, the food mark and the caterer's name. */
function Plate({ item, lang, design, caterer }: { item: MenuItem; lang: Lang; design: Design; caterer: string }) {
  const showEn = lang !== "local" || !item.nameLocal;
  const showLocal = lang !== "en" && !!item.nameLocal;
  return (
    <div
      className={cn(
        "flex aspect-[3/2] break-inside-avoid flex-col items-center justify-center gap-2 rounded-xl p-5 text-center",
        design === "classic" && "border-2 border-accent-gold bg-surface outline outline-1 outline-offset-[-8px] outline-accent-gold/50",
        design === "brand" && "bg-brand text-brand-fg",
        design === "minimal" && "border border-border bg-surface",
      )}
    >
      <VegMark diet={item.diet} />
      {showEn && <p className="font-heading text-2xl font-bold leading-tight print:text-4xl">{item.name}</p>}
      {showLocal && <p className={cn("leading-tight", showEn ? "text-lg opacity-80 print:text-2xl" : "font-heading text-2xl font-bold print:text-4xl")}>{item.nameLocal}</p>}
      <p className={cn("mt-1 text-xs uppercase tracking-[0.14em]", design === "brand" ? "opacity-70" : "text-text-muted")}>{caterer}</p>
    </div>
  );
}

/** Printed counter tags for one function's menu, with a repeat count per dish for dishes served at more than one counter. */
export function NamePlates({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const tenant = useStore((s) => s.tenant);
  const functions = [...order.functions].sort((a, b) => a.date.localeCompare(b.date));
  const [fnId, setFnId] = React.useState(functions[0]?.id ?? "");
  const [lang, setLang] = React.useState<Lang>("both");
  const [design, setDesign] = React.useState<Design>("classic");
  const [repeat, setRepeat] = React.useState<Record<string, number>>({});
  const fn = functions.find((f) => f.id === fnId) ?? functions[0];
  // Plates follow the menu's category order, so the printed stack matches the buffet line.
  const dishes = categories.flatMap((c) => items.filter((i) => fn?.itemIds.includes(i.id) && i.categoryId === c.id));
  const count = (id: string) => repeat[id] ?? 1;
  const plates = dishes.flatMap((d) => Array.from({ length: count(d.id) }, (_, i) => ({ d, key: `${d.id}-${i}` })));

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Counter name plates"
      description={`${plates.length} plates for ${fn?.name ?? ""}. Print on card and fold along the middle.`}
      wide
      footer={<Button variant="primary" disabled={!plates.length} onClick={printLight}><Printer strokeWidth={1.75} />Print {plates.length} plates</Button>}
    >
      <div className="space-y-4 print:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Function"><Select value={fn?.id} onChange={(e) => { setFnId(e.target.value); setRepeat({}); }}>{functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
          <Field label="Language">
            <Select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              <option value="both">English and Gujarati</option>
              <option value="en">English only</option>
              <option value="local">Gujarati only</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">{designs.map((d) => <Chip key={d.id} active={design === d.id} onClick={() => setDesign(d.id)}>{d.label}</Chip>)}</div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-muted">Plates per dish</p>
          <ul className="divide-y rounded-xl border">
            {dishes.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-2"><VegMark diet={d.diet} /><span className="truncate">{d.name}</span></span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Fewer plates for ${d.name}`} disabled={count(d.id) === 0} onClick={() => setRepeat((r) => ({ ...r, [d.id]: count(d.id) - 1 }))}><Minus strokeWidth={1.75} /></Button>
                  <span className="tnum w-6 text-center font-medium">{count(d.id)}</span>
                  <Button variant="ghost" size="icon" aria-label={`More plates for ${d.name}`} disabled={count(d.id) >= 9} onClick={() => setRepeat((r) => ({ ...r, [d.id]: count(d.id) + 1 }))}><Plus strokeWidth={1.75} /></Button>
                </span>
              </li>
            ))}
            {dishes.length === 0 && <li className="px-3 py-4 text-center text-sm text-text-muted">This function has no dishes yet.</li>}
          </ul>
          <p className="mt-1 text-xs text-text-muted">Set 0 to leave a dish out, or 2 and more for a dish served at several counters.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 print:mt-0 print:gap-4" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
        {plates.map(({ d, key }) => <Plate key={key} item={d} lang={lang} design={design} caterer={tenant.name} />)}
      </div>
    </Sheet>
  );
}
