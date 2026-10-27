"use client";

import { ArrowLeftRight, ClipboardCheck, PackagePlus, Plus, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState, MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Chip } from "@/components/ui/primitives";
import { Modal, Sheet } from "@/components/ui/sheet";
import { fmtQty } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import { sections, units, type Ingredient, type MovementType, type Section } from "@/lib/supply-types";
import { cn, daysFromToday, fmtDate, money, rate } from "@/lib/utils";
import { Num, useStock } from "./common";

const movementLabel: Record<MovementType, string> = { opening: "Opening stock", purchase: "Purchase", issue: "Issued to event", return: "Returned from event", wastage: "Wastage", adjustment: "Stock-take adjustment", transfer: "Transfer" };
const entryKinds: { id: MovementType; label: string; sign: 1 | -1 }[] = [
  { id: "purchase", label: "Stock in", sign: 1 },
  { id: "issue", label: "Issue to event", sign: -1 },
  { id: "return", label: "Return from event", sign: 1 },
  { id: "wastage", label: "Wastage", sign: -1 },
];

function IngredientSheet({ open, onOpenChange, ingredient, storeId }: { open: boolean; onOpenChange: (o: boolean) => void; ingredient?: Ingredient; storeId: string }) {
  return <IngredientForm key={`${open}-${ingredient?.id ?? "new"}`} open={open} onOpenChange={onOpenChange} ingredient={ingredient} storeId={storeId} />;
}

function IngredientForm({ open, onOpenChange, ingredient, storeId }: { open: boolean; onOpenChange: (o: boolean) => void; ingredient?: Ingredient; storeId: string }) {
  const saveIngredient = useSupply((s) => s.saveIngredient);
  const movements = useSupply((s) => s.movements);
  const stores = useSupply((s) => s.stores);
  const [form, setForm] = React.useState<Omit<Ingredient, "id">>(() => ingredient ?? { name: "", unit: "kg", section: "grocery", reorderLevel: 0, lastRate: 0, location: "" });
  const [opening, setOpening] = React.useState(0);
  const ledger = ingredient ? movements.filter((m) => m.ingredientId === ingredient.id && (!storeId || m.storeId === storeId)) : [];
  const valid = form.name.trim().length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={ingredient ? ingredient.name : "Add ingredient"}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { saveIngredient({ ...form, name: form.name.trim(), id: ingredient?.id }, opening); onOpenChange(false); toast.success(ingredient ? "Ingredient updated" : "Ingredient added"); }}>Save</Button></>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Basmati rice" /></Field>
        <Field label="Unit"><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{units.map((u) => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Store section"><Select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value as Section })}>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
        <Field label={`Latest rate per ${form.unit}`} hint="Dish costs follow this rate."><MoneyInput value={form.lastRate} onChange={(v) => setForm({ ...form, lastRate: v })} /></Field>
        <Field label="Reorder level" hint="Flagged as low below this."><Num className="text-left" value={form.reorderLevel} onChange={(v) => setForm({ ...form, reorderLevel: v })} /></Field>
        <Field label="Storage location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Rack 2, cold room" /></Field>
        <Field label="Expires on (optional)"><Input type="date" value={form.expiresOn ?? ""} onChange={(e) => setForm({ ...form, expiresOn: e.target.value || undefined })} /></Field>
        {!ingredient && <Field label={`Opening stock (${form.unit})`} className="col-span-2"><Num className="text-left" value={opening} onChange={setOpening} /></Field>}
      </div>
      {ingredient && (
        <div className="mt-6">
          <h3 className="font-heading text-base font-semibold">Stock ledger{stores.length > 1 && storeId ? ` · ${stores.find((s) => s.id === storeId)?.name}` : ""}</h3>
          {ledger.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No stock entries yet.</p>
          ) : (
            <ul className="tnum mt-2 divide-y text-sm">
              {ledger.slice(0, 40).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="block truncate">{movementLabel[m.type]}{m.note ? ` · ${m.note}` : ""}</span><span className="block text-xs text-text-muted">{fmtDate(m.at, { day: "numeric", month: "short" })}{m.rate ? ` · ${rate(m.rate)} per ${ingredient.unit}` : ""}</span></span>
                  <span className={cn("shrink-0 font-medium", m.qty < 0 ? "text-danger" : "text-success")}>{m.qty > 0 ? "+" : ""}{fmtQty(m.qty)} {ingredient.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

function EntrySheet({ open, onOpenChange, storeId }: { open: boolean; onOpenChange: (o: boolean) => void; storeId: string }) {
  const { ingredients, stores } = useSupply();
  const addMovement = useSupply((s) => s.addMovement);
  const transfer = useSupply((s) => s.transfer);
  const stock = useStock(storeId);
  const [kind, setKind] = React.useState<MovementType>("purchase");
  const [ingredientId, setIngredientId] = React.useState("");
  const [qty, setQty] = React.useState(0);
  const [note, setNote] = React.useState("");
  const [to, setTo] = React.useState("");
  const ingredient = ingredients.find((i) => i.id === ingredientId);
  const have = stock.get(ingredientId) ?? 0;
  const out = kind === "transfer" || entryKinds.find((k) => k.id === kind)?.sign === -1;
  const over = out && qty > have;
  const valid = !!ingredient && qty > 0 && !over && (kind !== "transfer" || (!!to && to !== storeId));

  const save = () => {
    if (!ingredient) return;
    if (kind === "transfer") transfer(ingredient.id, storeId, to, qty);
    else addMovement({ ingredientId: ingredient.id, storeId, type: kind, qty: out ? -qty : qty, rate: kind === "purchase" ? ingredient.lastRate : undefined, note });
    toast.success(`${fmtQty(qty)} ${ingredient.unit} of ${ingredient.name} recorded`);
    setQty(0);
    setNote("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Stock entry" description={stores.find((s) => s.id === storeId)?.name} footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Done</Button><Button variant="primary" disabled={!valid} onClick={save}>Record entry</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {entryKinds.map((k) => <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</Chip>)}
          {stores.length > 1 && <Chip active={kind === "transfer"} onClick={() => setKind("transfer")}><ArrowLeftRight strokeWidth={1.75} />Transfer</Chip>}
        </div>
        <Field label="Ingredient">
          <Select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
            <option value="">Choose an ingredient</option>
            {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
        </Field>
        <Field label={`Quantity${ingredient ? ` (${ingredient.unit})` : ""}`} error={over ? `Only ${fmtQty(have)} ${ingredient?.unit} in this store` : ""} hint={ingredient ? `In this store now: ${fmtQty(have)} ${ingredient.unit}` : undefined}>
          <Num className="text-left" value={qty} onChange={setQty} />
        </Field>
        {kind === "transfer" ? (
          <Field label="Move to"><Select value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose a store</option>{stores.filter((s) => s.id !== storeId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        ) : (
          <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Event name, reason, bill number" /></Field>
        )}
      </div>
    </Sheet>
  );
}

function StockTakeSheet({ open, onOpenChange, storeId }: { open: boolean; onOpenChange: (o: boolean) => void; storeId: string }) {
  const ingredients = useSupply((s) => s.ingredients);
  const stockTake = useSupply((s) => s.stockTake);
  const stock = useStock(storeId);
  const [counted, setCounted] = React.useState<Record<string, number>>({});
  const variance = Object.entries(counted).reduce((s, [id, count]) => s + (count - (stock.get(id) ?? 0)) * (ingredients.find((i) => i.id === id)?.lastRate ?? 0), 0);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Stock-take"
      description="Enter what you counted. Only the lines you fill are adjusted."
      wide
      footer={
        <>
          <span className={cn("tnum mr-auto text-sm", variance < 0 ? "text-danger" : "text-text-muted")}>Variance {variance < 0 ? "-" : "+"}{money(Math.abs(variance))}</span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!Object.keys(counted).length} onClick={() => { const n = stockTake(storeId, counted); setCounted({}); onOpenChange(false); toast.success(n ? `${n} ${n === 1 ? "item" : "items"} adjusted` : "Counts match the books"); }}>Save counts</Button>
        </>
      }
    >
      <table className="tnum w-full text-sm">
        <thead className="text-left text-xs text-text-muted"><tr><th className="py-2 font-medium">Ingredient</th><th className="py-2 text-right font-medium">Books</th><th className="w-28 py-2 pl-3 text-right font-medium">Counted</th><th className="w-24 py-2 text-right font-medium">Variance</th></tr></thead>
        <tbody className="divide-y">
          {ingredients.map((i) => {
            const books = stock.get(i.id) ?? 0;
            const diff = i.id in counted ? counted[i.id] - books : null;
            return (
              <tr key={i.id}>
                <td className="py-1.5">{i.name}</td>
                <td className="py-1.5 text-right text-text-muted">{fmtQty(books)} {i.unit}</td>
                <td className="py-1 pl-3"><Num aria-label={`Counted ${i.name}`} value={counted[i.id] ?? 0} onChange={(v) => setCounted((c) => ({ ...c, [i.id]: v }))} /></td>
                <td className={cn("py-1.5 text-right", diff === null ? "text-text-muted" : diff < 0 ? "text-danger" : diff > 0 ? "text-success" : "")}>{diff === null ? "–" : `${diff > 0 ? "+" : ""}${fmtQty(diff)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Sheet>
  );
}

/** Ingredient master with live stock per store, low-stock and expiry flags, ledger, entries and stock-take. */
export function StockTab() {
  const { ingredients, stores } = useSupply();
  const addStore = useSupply((s) => s.addStore);
  const [storeId, setStoreId] = React.useState("");
  const store = storeId || stores[0]?.id || "";
  const all = stores.length > 1 && storeId === "all";
  const stock = useStock(all ? undefined : store);
  const [query, setQuery] = React.useState("");
  const [section, setSection] = React.useState<Section | "all" | "low">("all");
  const [editing, setEditing] = React.useState<Ingredient | "new" | null>(null);
  const [entry, setEntry] = React.useState(false);
  const [take, setTake] = React.useState(false);
  const [newStore, setNewStore] = React.useState<string | null>(null);

  const rows = ingredients.map((i) => {
    const qty = stock.get(i.id) ?? 0;
    const expiresIn = i.expiresOn ? daysFromToday(i.expiresOn) : null;
    return { i, qty, low: i.reorderLevel > 0 && qty < i.reorderLevel, expiresIn };
  });
  const lowCount = rows.filter((r) => r.low).length;
  const shown = rows.filter((r) => (section === "all" ? true : section === "low" ? r.low : r.i.section === section)).filter((r) => !query.trim() || r.i.name.toLowerCase().includes(query.trim().toLowerCase()));
  const value = rows.reduce((s, r) => s + Math.max(0, r.qty) * r.i.lastRate, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
          <span className="sr-only">Search ingredients</span>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ingredients" className="bg-surface pl-10" />
        </label>
        <Select aria-label="Store" value={all ? "all" : store} onChange={(e) => (e.target.value === "new" ? setNewStore("") : setStoreId(e.target.value))} className="w-auto bg-surface">
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          {stores.length > 1 && <option value="all">All stores together</option>}
          <option value="new">Add a store or kitchen…</option>
        </Select>
        <Button disabled={all || !store} onClick={() => setTake(true)}><ClipboardCheck strokeWidth={1.75} />Stock-take</Button>
        <Button disabled={all || !store} onClick={() => setEntry(true)}><PackagePlus strokeWidth={1.75} />Stock entry</Button>
        <Button onClick={() => setEditing("new")}><Plus strokeWidth={1.75} />Ingredient</Button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <Chip active={section === "all"} onClick={() => setSection("all")}>All<span className="tnum text-xs">{rows.length}</span></Chip>
        <Chip active={section === "low"} onClick={() => setSection("low")}>Low stock<span className="tnum text-xs">{lowCount}</span></Chip>
        {sections.map((s) => <Chip key={s.id} active={section === s.id} onClick={() => setSection(s.id)}>{s.label}</Chip>)}
        <span className="tnum ml-auto self-center text-xs text-text-muted max-md:hidden">Stock value {money(value)}</span>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={PackagePlus} title="No ingredients here" help="Change the filter, or add the ingredient." action={<Button variant="primary" onClick={() => setEditing("new")}>Add ingredient</Button>} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface-muted text-left text-xs text-text-muted"><tr><th className="px-4 py-3 font-medium">Ingredient</th><th className="px-4 py-3 text-right font-medium">In stock</th><th className="px-4 py-3 text-right font-medium">Reorder at</th><th className="px-4 py-3 text-right font-medium">Rate</th><th className="px-4 py-3 text-right font-medium">Value</th></tr></thead>
            <tbody className="tnum divide-y">
              {shown.map(({ i, qty, low, expiresIn }) => (
                <tr key={i.id} tabIndex={0} onClick={() => setEditing(i)} onKeyDown={(e) => e.key === "Enter" && setEditing(i)} className="cursor-pointer hover:bg-surface-muted/60">
                  <td className="px-4 py-2.5"><span className="font-medium">{i.name}</span><span className="ml-2 inline-flex gap-1 align-middle">{low && <Badge tone="warning">Low</Badge>}{expiresIn !== null && expiresIn <= 7 && <Badge tone="danger">{expiresIn < 0 ? "Expired" : `Expires in ${expiresIn}d`}</Badge>}</span><span className="block text-xs text-text-muted">{sections.find((s) => s.id === i.section)?.label}{i.location ? ` · ${i.location}` : ""}</span></td>
                  <td className={cn("px-4 py-2.5 text-right font-medium", low && "text-warning")}>{fmtQty(qty)} {i.unit}</td>
                  <td className="px-4 py-2.5 text-right text-text-muted">{i.reorderLevel ? fmtQty(i.reorderLevel) : "–"}</td>
                  <td className="px-4 py-2.5 text-right">{rate(i.lastRate)}</td>
                  <td className="px-4 py-2.5 text-right">{money(Math.max(0, qty) * i.lastRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <IngredientSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} ingredient={editing && editing !== "new" ? editing : undefined} storeId={all ? "" : store} />
      <EntrySheet open={entry} onOpenChange={setEntry} storeId={store} />
      <StockTakeSheet open={take} onOpenChange={setTake} storeId={store} />
      <Modal open={newStore !== null} onOpenChange={(o) => !o && setNewStore(null)} title="Add a store or kitchen" description="Stock is tracked separately for each one, and can be transferred between them." footer={<><Button variant="ghost" onClick={() => setNewStore(null)}>Cancel</Button><Button variant="primary" disabled={!newStore?.trim()} onClick={() => { addStore(newStore!); setNewStore(null); toast.success("Store added"); }}>Add store</Button></>}>
        <Field label="Name"><Input autoFocus value={newStore ?? ""} onChange={(e) => setNewStore(e.target.value)} placeholder="Second kitchen, Naroda" /></Field>
      </Modal>
    </div>
  );
}
