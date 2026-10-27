"use client";

import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { standardEventTypes, type EventType } from "@/lib/event-types";
import { useCurrentUser, useStore } from "@/lib/store";
import { uid } from "@/lib/utils";

/**
 * The event types offered in the enquiry, quotation and booking forms. An account on the standard list sees it
 * here; the first change turns it into the account's own list. Removing a type never changes past records.
 */
export function EventTypesForm() {
  const ready = useStore((s) => s.eventTypesReady);
  const own = useStore((s) => s.eventTypes);
  const enquiries = useStore((s) => s.enquiries);
  const orders = useStore((s) => s.orders);
  const setEventTypes = useStore((s) => s.setEventTypes);
  const isOwner = useCurrentUser().role === "owner";
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const onStandard = own.length === 0;
  // The list being shown: the account's own, or the standard one with fresh ids ready to become its own.
  const [standard] = React.useState<EventType[]>(() => standardEventTypes.map((n) => ({ id: uid(), name: n })));
  const list = onStandard ? standard : own;
  const used = (n: string) => enquiries.filter((e) => e.eventType === n).length + orders.filter((o) => o.eventType === n).length;

  const save = async (next: EventType[], message: string) => {
    setBusy(true);
    try {
      await setEventTypes(next);
      toast.success(message);
    } catch (e) {
      toast.error("Event types were not saved", { description: e instanceof Error && /duplicate|unique/i.test(e.message) ? "Two event types have the same name." : e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (list.some((e) => e.name.toLowerCase() === n.toLowerCase())) return toast.error(`${n} is already in the list`);
    void save([...list, { id: uid(), name: n }], `${n} added`);
    setName("");
  };
  const rename = (e: EventType, value: string) => {
    const n = value.trim();
    if (!n || n === e.name) return;
    if (list.some((x) => x.id !== e.id && x.name.toLowerCase() === n.toLowerCase())) return toast.error(`${n} is already in the list`);
    void save(list.map((x) => (x.id === e.id ? { ...x, name: n } : x)), `Renamed to ${n}`);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    void save(next, "Order saved");
  };

  if (!ready) return <p className="text-sm text-text-muted">Run the 0017 database update to keep your own list of event types.</p>;
  const canEdit = isOwner;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-text-muted">The events you cater for. Only these appear in the Event type list of enquiries, quotations and bookings, in this order. Removing one never changes enquiries or bookings that already use it.</p>
        {onStandard && <p className="mt-2 rounded-lg bg-surface-muted p-3 text-sm">You are on the standard list. Change anything below, or <Link className="text-primary hover:underline" href="/import">import your own list</Link>, and it becomes yours.</p>}
        {!canEdit && <p className="mt-2 text-sm text-text-muted">Only the owner can change event types.</p>}
      </div>

      <ul className="divide-y rounded-xl border">
        {list.map((e, i) => (
          <li key={e.id} className="flex items-center gap-2 px-3 py-2">
            {canEdit && (
              <span className="flex shrink-0 flex-col">
                <button type="button" disabled={i === 0 || busy} onClick={() => move(i, -1)} aria-label={`Move ${e.name} up`} className="grid size-6 place-items-center rounded text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30"><ArrowUp className="size-4" strokeWidth={1.75} /></button>
                <button type="button" disabled={i === list.length - 1 || busy} onClick={() => move(i, 1)} aria-label={`Move ${e.name} down`} className="grid size-6 place-items-center rounded text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30"><ArrowDown className="size-4" strokeWidth={1.75} /></button>
              </span>
            )}
            {canEdit ? (
              <Input key={e.name} aria-label={`Name of ${e.name}`} defaultValue={e.name} disabled={busy} onBlur={(ev) => rename(e, ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()} className="flex-1" />
            ) : (
              <span className="flex-1 text-sm font-medium">{e.name}</span>
            )}
            <span className="tnum w-24 shrink-0 text-right text-xs text-text-muted">{used(e.name) ? `${used(e.name)} in use` : ""}</span>
            {canEdit && <Button variant="ghost" size="icon" disabled={busy} aria-label={`Delete ${e.name}`} onClick={() => void save(list.filter((x) => x.id !== e.id), `${e.name} removed`)}><Trash2 strokeWidth={1.75} /></Button>}
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-muted">No event types. Add the first one below.</li>}
      </ul>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="New event type" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Griha Shanti, Satyanarayan Katha, Corporate lunch" className="min-w-56 flex-1" />
          <Button variant="primary" disabled={!name.trim() || busy} onClick={add}><Plus strokeWidth={2} />Add event type</Button>
          {!onStandard && <Button variant="ghost" disabled={busy} onClick={() => void save([], "Back to the standard list")}><RotateCcw strokeWidth={1.75} />Use the standard list</Button>}
        </div>
      )}
    </div>
  );
}
