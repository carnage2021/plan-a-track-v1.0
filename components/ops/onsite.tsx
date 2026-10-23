"use client";

import { AlertTriangle, Check, CheckCircle2, Clock, MapPin, MessageCircle, Minus, Navigation, Phone, Plus, Receipt, Signature, Trash2, Users } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge, VegMark } from "@/components/shared/badges";
import { MoneyInput, ServiceLabel } from "@/components/shared/blocks";
import { Num } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card, CardTitle, Chip, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { mediaUrl } from "@/lib/db";
import { checkSteps, issueKinds, useOps, type CheckStep, type IssueKind } from "@/lib/operations";
import { priceQuote } from "@/lib/pricing";
import { useStaff } from "@/lib/staff";
import { useCurrentUser, useStore } from "@/lib/store";
import type { EventFunction, Order } from "@/lib/types";
import { cn, fmtDate, fmtTime, money, num, whatsappLink, localDay } from "@/lib/utils";
import { ExpenseSheet } from "@/components/expenses/expense-sheet";
import { useExpenses } from "@/lib/expenses";
import { PhotoButton, SignaturePad } from "./common";
import { FunctionTrips } from "./dispatch";

const noChecks: Partial<Record<CheckStep, string>> = {};
const at = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "");

/** Extra charge for serving more guests than booked, worked out with the order's own package and slab rules. */
function useExtraPlates(order: Order, fn: EventFunction, finalPax: number) {
  const { items, packages, tenant } = useStore();
  return React.useMemo(() => {
    if (finalPax <= fn.pax) return 0;
    const next = { ...order, functions: order.functions.map((f) => (f.id === fn.id ? { ...f, pax: finalPax } : f)) };
    return priceQuote(next, items, packages, tenant.slabs).grand - priceQuote(order, items, packages, tenant.slabs).grand;
  }, [order, fn, finalPax, items, packages, tenant.slabs]);
}

function GuestCounter({ order, fn, locked }: { order: Order; fn: EventFunction; locked: boolean }) {
  const guests = useOps((s) => s.onsite[fn.id]?.guests ?? 0);
  const patchOnsite = useOps((s) => s.patchOnsite);
  const set = (n: number) => patchOnsite(fn.id, order.id, { guests: Math.max(0, n) });
  const over = guests - fn.pax;
  return (
    <Card className="p-5">
      <p className="flex items-center justify-between text-sm text-text-muted"><span className="inline-flex items-center gap-1.5"><Users className="size-4" strokeWidth={1.75} />Guests served so far</span><span className="tnum">Booked {num(fn.pax)}</span></p>
      <p className="tnum mt-2 text-center font-heading text-6xl font-bold" aria-live="polite">{num(guests)}</p>
      <p className={cn("mt-1 text-center text-sm", over > 0 ? "font-medium text-warning" : "text-text-muted")}>{over > 0 ? `${num(over)} over the booking; they go on the bill at sign-off` : `${num(fn.pax - guests)} to go`}</p>
      {!locked && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          <Button size="lg" variant="ghost" aria-label="One less" onClick={() => set(guests - 1)}><Minus strokeWidth={1.75} /></Button>
          <Button size="lg" onClick={() => set(guests + 1)}>+1</Button>
          <Button size="lg" onClick={() => set(guests + 10)}>+10</Button>
          <Button size="lg" variant="primary" onClick={() => set(guests + 50)}>+50</Button>
        </div>
      )}
      {!locked && <label className="mt-3 flex items-center justify-between gap-3 text-sm text-text-muted">Set the count directly<Num aria-label="Guests served" className="w-28" value={guests} onChange={set} /></label>}
    </Card>
  );
}

function Checklist({ order, fn, locked }: { order: Order; fn: EventFunction; locked: boolean }) {
  const checklist = useOps((s) => s.onsite[fn.id]?.checklist ?? noChecks);
  const patchOnsite = useOps((s) => s.patchOnsite);
  const setOrderStatus = useStore((s) => s.setOrderStatus);
  const toggle = (id: CheckStep) => {
    const next = { ...checklist };
    if (next[id]) delete next[id];
    else next[id] = new Date().toISOString();
    patchOnsite(fn.id, order.id, { checklist: next });
    // The first tick at the venue means the event has started.
    if (!checklist[id] && order.status === "confirmed") setOrderStatus(order.id, "in_progress");
  };
  const done = checkSteps.filter((s) => checklist[s.id]).length;
  return (
    <Card>
      <CardTitle action={<span className="tnum text-sm text-text-muted">{done} of {checkSteps.length}</span>}>Event checklist</CardTitle>
      <ol className="space-y-1 p-2">
        {checkSteps.map((s, i) => {
          const time = checklist[s.id];
          return (
            <li key={s.id}>
              <button type="button" disabled={locked} onClick={() => toggle(s.id)} aria-pressed={!!time} className={cn("flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors", time ? "bg-success/10" : "hover:bg-surface-muted/60", locked && "cursor-default")}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold", time ? "border-success bg-success text-primary-fg" : "border-border text-text-muted")}>{time ? <Check className="size-4" strokeWidth={2.5} /> : i + 1}</span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{s.label}</span><span className="block text-sm text-text-muted">{s.help}</span></span>
                {time && <span className="tnum shrink-0 text-sm font-medium text-success">{at(time)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Issues({ order, fn }: { order: Order; fn: EventFunction }) {
  const issues = useOps((s) => s.issues).filter((i) => i.functionId === fn.id);
  const { addIssue, resolveIssue } = useOps();
  const me = useCurrentUser();
  const [kind, setKind] = React.useState<IssueKind>("short_item");
  const [note, setNote] = React.useState("");
  const [photo, setPhoto] = React.useState<string>();
  const log = () => {
    addIssue({ orderId: order.id, functionId: fn.id, kind, note: note.trim(), photoPath: photo, reportedBy: me.name });
    toast.success("Issue logged", { description: "The owner sees it on the dashboard and on the order." });
    setNote("");
    setPhoto(undefined);
  };
  return (
    <Card>
      <CardTitle>Issues</CardTitle>
      <div className="space-y-3 px-4 pb-4 md:px-5">
        <div className="flex flex-wrap gap-2">{issueKinds.map((k) => <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</Chip>)}</div>
        <Textarea value={note} placeholder="What happened, and what is being done about it" onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <PhotoButton variant="ghost" label={photo ? "Retake photo" : "Add a photo"} onUploaded={setPhoto} />
          {photo && <img src={mediaUrl(photo)} alt="Issue photo" className="size-11 rounded-lg object-cover" />}
          <Button variant="primary" className="ml-auto" disabled={!note.trim()} onClick={log}><AlertTriangle strokeWidth={1.75} />Log issue</Button>
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="divide-y border-t">
          {[...issues].reverse().map((i) => (
            <li key={i.id} className={cn("flex gap-3 px-4 py-3 md:px-5", i.resolved && "opacity-60")}>
              {i.photoPath && <a href={mediaUrl(i.photoPath)} target="_blank" rel="noreferrer" className="shrink-0"><img src={mediaUrl(i.photoPath)} alt="" className="size-14 rounded-lg object-cover" /></a>}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{issueKinds.find((k) => k.id === i.kind)?.label}{i.resolved ? <Badge tone="success">Resolved</Badge> : <Badge tone="danger">Open</Badge>}</p>
                <p className="mt-0.5 text-sm">{i.note}</p>
                <p className="tnum mt-0.5 text-xs text-text-muted">{at(i.createdAt)}{i.reportedBy && ` · ${i.reportedBy}`}</p>
              </div>
              <Button variant="ghost" className="shrink-0" onClick={() => resolveIssue(i.id, !i.resolved)}>{i.resolved ? "Reopen" : "Resolved"}</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MenuAndStaff({ fn }: { fn: EventFunction }) {
  const { items, categories } = useStore();
  const tasks = useStaff((s) => s.tasks);
  const workers = useStaff((s) => s.workers);
  const staffReady = useStaff((s) => s.ready);
  const dishes = fn.itemIds.map((id) => items.find((i) => i.id === id)).filter((i) => !!i);
  // One counter per menu category, in the order the menu lists them.
  const counters = categories.map((c) => ({ c, dishes: dishes.filter((d) => d.categoryId === c.id) })).filter((x) => x.dishes.length);
  const crew = tasks.filter((t) => t.functionId === fn.id);
  return (
    <>
      <Card>
        <CardTitle action={<span className="text-sm text-text-muted">{counters.length} counters · {dishes.length} dishes</span>}>Menu and counter layout</CardTitle>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:p-5">
          {counters.map(({ c, dishes }, n) => (
            <div key={c.id} className="rounded-xl border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Counter {n + 1} · {c.name}</p>
              <ul className="mt-2 space-y-1 text-sm">{dishes.map((d) => <li key={d.id} className="flex items-center gap-2"><VegMark diet={d.diet} /><span className="min-w-0 flex-1">{d.name}{fn.itemNotes?.[d.id] && <span className="block text-xs text-warning">{fn.itemNotes[d.id]}</span>}</span>{d.outsourced && <Badge tone="gold">Agency</Badge>}</li>)}</ul>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle action={<span className="text-sm text-text-muted">{crew.length} on duty</span>}>Staff on duty</CardTitle>
        {!staffReady || crew.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-text-muted">No staff tasks for this function yet. They are planned on the order&apos;s Staff and Tasks tab.</p>
        ) : (
          <ul className="divide-y">
            {crew.map((t) => {
              const w = workers.find((x) => x.id === t.workerId);
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm md:px-5">
                  <span className="min-w-0 flex-1"><span className="block font-medium">{w?.name ?? "Not assigned"}</span><span className="block text-text-muted">{t.title}{t.startTime && ` · from ${fmtTime(t.startTime)}`}</span></span>
                  {w?.phone && <Button variant="ghost" size="icon" asChild aria-label={`Call ${w.name}`}><a href={`tel:${w.phone}`}><Phone strokeWidth={1.75} /></a></Button>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

function SignOff({ order, fn }: { order: Order; fn: EventFunction }) {
  const record = useOps((s) => s.onsite[fn.id]);
  const patchOnsite = useOps((s) => s.patchOnsite);
  const { changePax, addOrderExtra } = useStore();
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const [name, setName] = React.useState(client?.name ?? "");
  const [finalPax, setFinalPax] = React.useState(Math.max(record?.guests ?? 0, fn.pax));
  const [extras, setExtras] = React.useState<{ label: string; amount: number }[]>([]);
  const [sign, setSign] = React.useState<Blob | null>(null);
  const [busy, setBusy] = React.useState(false);
  const plates = useExtraPlates(order, fn, finalPax);
  const extraPax = Math.max(0, finalPax - fn.pax);

  if (record?.signedAt)
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 font-heading text-lg font-semibold text-success"><CheckCircle2 className="size-5" strokeWidth={1.75} />Signed off</p>
        <p className="tnum mt-1 text-sm text-text-muted">{record.signoffName}, {fmtDate(localDay(record.signedAt), { day: "numeric", month: "short" })} at {at(record.signedAt)} · {num(record.guests)} guests</p>
        {record.signoffPath && <img src={mediaUrl(record.signoffPath)} alt={`Signature of ${record.signoffName}`} className="mt-4 h-32 rounded-xl border bg-white object-contain p-2" />}
      </Card>
    );

  const submit = async () => {
    if (!sign) return;
    setBusy(true);
    try {
      const path = await useStore.getState().uploadMedia(sign, `signoff-${fn.id}.png`);
      if (extraPax > 0) changePax(order.id, fn.id, finalPax, plates);
      for (const x of extras.filter((x) => x.label.trim() && x.amount > 0)) addOrderExtra(order.id, `${fn.name}: ${x.label.trim()}`, x.amount);
      patchOnsite(fn.id, order.id, { guests: finalPax, signoffName: name.trim(), signoffPath: path, signedAt: new Date().toISOString() });
      toast.success("Signed off", { description: extraPax > 0 || extras.length ? "Extra plates and charges are on the final bill." : "Nothing extra to bill." });
    } catch (e) {
      toast.error("The signature could not be saved", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="flex items-center gap-2 font-heading text-lg font-semibold"><Signature className="size-5" strokeWidth={1.75} />Client sign-off</h3>
        <p className="text-sm text-text-muted">Confirm the final guest count and extras with the client, then hand them the phone to sign.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Final guest count" hint={`Booked ${num(fn.pax)}. Fewer guests are billed at the booked count.`}><Num value={finalPax} onChange={setFinalPax} /></Field>
        <div className="rounded-xl bg-surface-muted p-3 text-sm">
          <p className="text-text-muted">Extra plates</p>
          <p className="tnum font-heading text-xl font-bold">{num(extraPax)}</p>
          <p className="tnum text-text-muted">{extraPax ? `+${money(plates)} with GST` : "None to bill"}</p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-text-muted">Other extras on the day</p>
        {extras.map((x, i) => (
          <div key={i} className="flex gap-2">
            <Input aria-label="What it was for" value={x.label} placeholder="Extra live counter, late service" onChange={(e) => setExtras(extras.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)))} />
            <MoneyInput className="w-32" value={x.amount} onChange={(amount) => setExtras(extras.map((y, k) => (k === i ? { ...y, amount } : y)))} />
            <Button variant="ghost" size="icon-lg" aria-label="Remove this extra" onClick={() => setExtras(extras.filter((_, k) => k !== i))}><Trash2 strokeWidth={1.75} /></Button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setExtras([...extras, { label: "", amount: 0 }])}><Plus strokeWidth={1.75} />Add an extra charge</Button>
      </div>
      {finalPax > fn.pax * 2 && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">That is more than double the {num(fn.pax)} booked. Check the count before the client signs.</p>}
      <Field label="Signed by"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <SignaturePad onChange={setSign} />
      <Button variant="primary" size="lg" className="w-full" loading={busy} disabled={!sign || !name.trim()} onClick={submit}><CheckCircle2 strokeWidth={1.75} />Confirm and sign off</Button>
    </Card>
  );
}

/** Ice, gas top-ups and tips paid at the venue, with the bill photo, straight onto the event's cost. */
function LogExpense({ orderId }: { orderId: string }) {
  const ready = useExpenses((s) => s.ready);
  const [open, setOpen] = React.useState(false);
  if (!ready) return null;
  return (
    <>
      <Button variant="ghost" className="w-full" onClick={() => setOpen(true)}><Receipt strokeWidth={1.75} />Add an expense paid at the venue</Button>
      <ExpenseSheet open={open} onOpenChange={setOpen} orderId={orderId} />
    </>
  );
}

/** The supervisor's phone screen for one function, from setup to the client's signature. */
export function OnsiteView({ order, fn }: { order: Order; fn: EventFunction }) {
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const signed = useOps((s) => !!s.onsite[fn.id]?.signedAt);
  const openIssues = useOps((s) => s.issues.filter((i) => i.functionId === fn.id && !i.resolved).length);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="p-5">
        <p className="text-sm text-text-muted">{order.number} · {order.eventType}</p>
        <h2 className="mt-0.5 font-heading text-2xl font-bold">{client?.name} · {fn.name}</h2>
        <p className="tnum mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1"><Clock className="size-4 text-text-muted" strokeWidth={1.75} />{fmtDate(fn.date, { weekday: "short", day: "numeric", month: "short" })}, <ServiceLabel fn={fn} /></span>
          <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-text-muted" strokeWidth={1.75} />{fn.venue}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {client?.phone && <Button asChild><a href={`tel:${client.phone}`}><Phone strokeWidth={1.75} />Call client</a></Button>}
          {client?.phone && <Button variant="ghost" asChild><a href={whatsappLink(client.phone, "")} target="_blank" rel="noreferrer"><MessageCircle strokeWidth={1.75} />WhatsApp</a></Button>}
          {fn.venue && <Button variant="ghost" asChild><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fn.venue)}`} target="_blank" rel="noreferrer"><Navigation strokeWidth={1.75} />Directions</a></Button>}
        </div>
        {order.instructions && <p className="mt-4 rounded-lg bg-warning/10 p-3 text-sm">{order.instructions}</p>}
      </Card>

      <Tabs defaultValue="live">
        <TabsList className="w-full">
          <TabsTrigger value="live" className="flex-1">Live{openIssues > 0 && <Badge tone="danger">{openIssues}</Badge>}</TabsTrigger>
          <TabsTrigger value="details" className="flex-1">Menu</TabsTrigger>
          <TabsTrigger value="trips" className="flex-1">Trips</TabsTrigger>
          <TabsTrigger value="signoff" className="flex-1">Sign-off{signed && <Check className="size-4 text-success" strokeWidth={2} />}</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="space-y-4">
          <GuestCounter order={order} fn={fn} locked={signed} />
          <Checklist order={order} fn={fn} locked={signed} />
          <Issues order={order} fn={fn} />
          <LogExpense orderId={order.id} />
        </TabsContent>
        <TabsContent value="details" className="space-y-4"><MenuAndStaff fn={fn} /></TabsContent>
        <TabsContent value="trips"><FunctionTrips order={order} fn={fn} showHead={false} /></TabsContent>
        <TabsContent value="signoff"><SignOff order={order} fn={fn} /></TabsContent>
      </Tabs>
    </div>
  );
}
