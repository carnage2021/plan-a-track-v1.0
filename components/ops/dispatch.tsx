"use client";

import { CheckCircle2, Clock, MapPin, MessageCircle, Pencil, Phone, Plus, Trash2, Truck, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState, MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, ToggleRow } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { mediaUrl } from "@/lib/db";
import { portions } from "@/lib/kitchen";
import { standardLoad, tripFlow, tripLabel, tripNext, useOps, type LoadLine, type Trip, type TripStatus, type Vehicle } from "@/lib/operations";
import { useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import type { EventFunction, Order } from "@/lib/types";
import { cn, fmtDate, fmtTime, money, num, whatsappLink } from "@/lib/utils";
import { PhotoButton } from "./common";
import { logWhatsApp } from "@/lib/messages";

const tripTone: Record<TripStatus, "neutral" | "warning" | "primary" | "success"> = { planned: "neutral", loading: "warning", dispatched: "primary", delivered: "success" };
export const TripBadge = ({ status }: { status: TripStatus }) => <Badge tone={tripTone[status]}><span className="size-1.5 rounded-full bg-current" aria-hidden />{tripLabel[status]}</Badge>;

/** Leave the kitchen this long before guests are served, by default. */
const departBefore = (time: string) => {
  const [h, m] = (time || "19:00").split(":").map(Number);
  const t = Math.max(0, h * 60 + m - 150);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** Everything a function needs carried: each dish the kitchen cooks, the cutlery challan and the standard kit. */
function useLoadList(fn: EventFunction) {
  const items = useStore((s) => s.items);
  const challans = useSupply((s) => s.challans);
  return React.useCallback(() => {
    const dishes = fn.itemIds
      .map((id) => items.find((i) => i.id === id))
      .filter((i) => i && !i.outsourced)
      .map((i) => ({ label: `${i!.name}: ${num(portions(i!, fn.pax))} ${i!.pricingType === "plate" ? "portions" : "counter"}`, done: false }));
    const challan = challans.find((c) => c.functionId === fn.id);
    const cutlery = challan ? [{ label: `Cutlery and crockery, challan ${challan.number} (${num(challan.lines.reduce((s, l) => s + (l.issued || l.required), 0))} pieces)`, done: false }] : [{ label: "Cutlery and crockery", done: false }];
    return [...dishes, ...cutlery, ...standardLoad.map((label) => ({ label, done: false }))];
  }, [fn, items, challans]);
}

const blankVehicle: Omit<Vehicle, "id"> = { name: "", regNumber: "", hired: false, capacity: "", ratePerTrip: 0, driverName: "", driverPhone: "", active: true };

/** The vehicle and driver master: own vans and trucks, and the ones hired per trip. */
export function VehicleSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const vehicles = useOps((s) => s.vehicles);
  const saveVehicle = useOps((s) => s.saveVehicle);
  const vendors = useSupply((s) => s.vendors);
  const transport = vendors.filter((v) => v.type === "transport");
  const [edit, setEdit] = React.useState<(Omit<Vehicle, "id"> & { id?: string }) | null>(null);
  const set = (patch: Partial<Vehicle>) => setEdit((e) => (e ? { ...e, ...patch } : e));

  const save = () => {
    if (!edit?.name.trim()) return;
    saveVehicle({ ...edit, name: edit.name.trim() });
    toast.success(`${edit.name.trim()} saved`);
    setEdit(null);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) setEdit(null); }}
      title={edit ? (edit.id ? `Edit ${edit.name}` : "Add a vehicle") : "Vehicles and drivers"}
      description={edit ? undefined : "Own vehicles and hired ones, with the usual driver and the rate per trip."}
      footer={edit ? <><Button variant="ghost" onClick={() => setEdit(null)}>Back</Button><Button variant="primary" disabled={!edit.name.trim()} onClick={save}>Save vehicle</Button></> : <Button variant="primary" onClick={() => setEdit({ ...blankVehicle })}><Plus strokeWidth={1.75} />Add a vehicle</Button>}
    >
      {edit ? (
        <div className="space-y-4">
          <Field label="Name"><Input autoFocus value={edit.name} placeholder="Tata Ace, Bolero pickup" onChange={(e) => set({ name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration number"><Input value={edit.regNumber} placeholder="GJ 01 AB 1234" onChange={(e) => set({ regNumber: e.target.value.toUpperCase() })} /></Field>
            <Field label="Capacity"><Input value={edit.capacity} placeholder="1 tonne, 40 crates" onChange={(e) => set({ capacity: e.target.value })} /></Field>
          </div>
          <ToggleRow checked={edit.hired} onCheckedChange={(hired) => set({ hired, vendorId: hired ? edit.vendorId : undefined })} label="Hired, not our own" />
          {edit.hired && (
            <Field label="Transport vendor" hint={transport.length ? undefined : "Add a vendor of type Transport on the Vendors page to pick it here."}>
              <Select value={edit.vendorId ?? ""} onChange={(e) => set({ vendorId: e.target.value || undefined })}>
                <option value="">Not linked</option>
                {transport.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Rate per trip" hint={edit.hired ? "What the vendor charges for one run." : "Fuel and driver cost for one run, used as the trip cost."}><MoneyInput value={edit.ratePerTrip} onChange={(ratePerTrip) => set({ ratePerTrip })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Usual driver"><Input value={edit.driverName} onChange={(e) => set({ driverName: e.target.value })} /></Field>
            <Field label="Driver phone"><Input inputMode="tel" value={edit.driverPhone} onChange={(e) => set({ driverPhone: e.target.value })} /></Field>
          </div>
          {edit.id && <ToggleRow checked={edit.active} onCheckedChange={(active) => set({ active })} label="In use" help="Switch off to hide it from new trips" />}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState icon={Truck} title="No vehicles yet" help="Add the vans and trucks that carry food to venues, your own and hired, so trips can be planned on them." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {vehicles.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => setEdit(v)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/60", !v.active && "opacity-50")}>
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Truck className="size-5" strokeWidth={1.75} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">{v.name}{v.hired && <Badge tone="gold">Hired</Badge>}{!v.active && <Badge>Not in use</Badge>}</span>
                  <span className="block truncate text-sm text-text-muted">{[v.regNumber, v.capacity, v.driverName].filter(Boolean).join(" · ") || "No details yet"}</span>
                </span>
                <span className="tnum shrink-0 text-sm">{money(v.ratePerTrip)}<span className="block text-xs text-text-muted">per trip</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

type TripDraft = Omit<Trip, "id"> & { id?: string };

function TripSheet({ draft, onClose }: { draft: TripDraft; onClose: () => void }) {
  const vehicles = useOps((s) => s.vehicles);
  const { addTrip, patchTrip } = useOps();
  const [t, setT] = React.useState(draft);
  const [line, setLine] = React.useState("");
  const set = (patch: Partial<Trip>) => setT((x) => ({ ...x, ...patch }));
  const pick = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    // A new vehicle brings its usual driver and rate; anything already typed in for this trip is replaced.
    set(v ? { vehicleId: v.id, driverName: v.driverName, driverPhone: v.driverPhone, cost: v.ratePerTrip } : { vehicleId: undefined });
  };
  const addLine = () => {
    if (!line.trim()) return;
    set({ loading: [...t.loading, { label: line.trim(), done: false }] });
    setLine("");
  };
  const save = () => {
    const { id, ...rest } = t;
    if (id) patchTrip(id, rest);
    else addTrip(rest);
    toast.success(id ? "Trip updated" : "Trip planned");
    onClose();
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={t.id ? "Edit trip" : "Plan a trip"} description="Vehicle, driver, when it leaves and what goes on it." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{t.id ? "Save trip" : "Plan trip"}</Button></>}>
      <div className="space-y-4">
        <Field label="Vehicle" hint={vehicles.length ? undefined : "No vehicles saved yet. Add them from Vehicles on the Dispatch page, or just type the driver below."}>
          <Select value={t.vehicleId ?? ""} onChange={(e) => pick(e.target.value)}>
            <option value="">Not chosen yet</option>
            {vehicles.filter((v) => v.active || v.id === t.vehicleId).map((v) => <option key={v.id} value={v.id}>{v.name}{v.regNumber ? ` (${v.regNumber})` : ""}{v.hired ? ", hired" : ""}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Driver"><Input value={t.driverName} onChange={(e) => set({ driverName: e.target.value })} /></Field>
          <Field label="Driver phone"><Input inputMode="tel" value={t.driverPhone} onChange={(e) => set({ driverPhone: e.target.value })} /></Field>
          <Field label="Leaves the kitchen at"><Input type="time" value={t.departTime} onChange={(e) => set({ departTime: e.target.value })} /></Field>
          <Field label="Trip cost" hint="Added to the event's transport cost"><MoneyInput value={t.cost} onChange={(cost) => set({ cost })} /></Field>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-muted">Loading list</p>
          <ul className="divide-y rounded-xl border text-sm">
            {t.loading.map((l, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5 pl-3 pr-1">
                <span className="min-w-0 flex-1">{l.label}</span>
                <Button variant="ghost" size="icon" aria-label={`Remove ${l.label}`} onClick={() => set({ loading: t.loading.filter((_, k) => k !== i) })}><X strokeWidth={1.75} /></Button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input value={line} placeholder="Add a line, e.g. Tandoor, 2 water jars" onChange={(e) => setLine(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLine())} />
            <Button onClick={addLine} disabled={!line.trim()}><Plus strokeWidth={1.75} />Add</Button>
          </div>
          <p className="mt-1 text-xs text-text-muted">When one function needs two vehicles, remove from each list what the other one carries.</p>
        </div>
        <Field label="Notes for the driver"><Textarea value={t.notes} placeholder="Gate 2, call the manager on arrival" onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}

function TripCard({ trip, fn, venue, onEdit }: { trip: Trip; fn: EventFunction; venue: string; onEdit: () => void }) {
  const vehicle = useOps((s) => s.vehicles.find((v) => v.id === trip.vehicleId));
  const trips = useOps((s) => s.trips);
  const { patchTrip, removeTrip } = useOps();
  const orders = useStore((s) => s.orders);
  const ticked = trip.loading.filter((l) => l.done).length;
  const allTicked = ticked === trip.loading.length;
  const step = tripFlow.indexOf(trip.status);
  const delivered = trip.status === "delivered";

  // The same vehicle cannot be on two runs that leave at the same time on one day.
  const clash = React.useMemo(() => {
    if (!trip.vehicleId || !trip.departTime) return false;
    const dateOf = (functionId: string) => orders.flatMap((o) => o.functions).find((f) => f.id === functionId)?.date;
    return trips.some((x) => x.id !== trip.id && x.vehicleId === trip.vehicleId && x.departTime === trip.departTime && dateOf(x.functionId) === fn.date);
  }, [trips, orders, trip, fn.date]);

  const tick = (i: number) => patchTrip(trip.id, { loading: trip.loading.map((l, k): LoadLine => (k === i ? { ...l, done: !l.done } : l)), ...(trip.status === "planned" ? { status: "loading" as const } : {}) });
  const advance = (proofPath?: string) => {
    const next = tripFlow[step + 1];
    patchTrip(trip.id, { status: next, ...(next === "delivered" ? { deliveredAt: new Date().toISOString(), proofPath } : {}) });
    toast.success(next === "delivered" ? "Delivery confirmed" : next === "dispatched" ? "Trip dispatched" : "Loading started");
  };
  const brief = [`${fn.name}, ${fmtDate(fn.date, { day: "numeric", month: "short" })}`, `Leave at ${fmtTime(trip.departTime)}. Guests served at ${fmtTime(fn.time)}.`, `Venue: ${venue}`, trip.notes, "", "Load:", ...trip.loading.map((l) => `- ${l.label}`)].filter((x) => x !== undefined).join("\n");

  return (
    <Card className={cn("p-4", clash && "border-warning")}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Truck className="size-5" strokeWidth={1.75} /></span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">{vehicle ? `${vehicle.name}${vehicle.regNumber ? ` · ${vehicle.regNumber}` : ""}` : "Vehicle not chosen"}<TripBadge status={trip.status} /></p>
          <p className="tnum mt-0.5 flex flex-wrap gap-x-3 text-sm text-text-muted">
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" strokeWidth={1.75} />Leaves {trip.departTime ? fmtTime(trip.departTime) : "time not set"}</span>
            {trip.driverName && <span>{trip.driverName}</span>}
            <span>{money(trip.cost)}</span>
          </p>
          {clash && <p className="mt-1 text-sm text-warning">This vehicle is on another trip leaving at the same time that day.</p>}
        </div>
        <div className="flex gap-1">
          {trip.driverPhone && <Button variant="ghost" size="icon" asChild aria-label="Call the driver"><a href={`tel:${trip.driverPhone}`}><Phone strokeWidth={1.75} /></a></Button>}
          {trip.driverPhone && <Button variant="ghost" size="icon" asChild aria-label="Send the driver the trip on WhatsApp"><a href={whatsappLink(trip.driverPhone, brief)} target="_blank" rel="noreferrer" onClick={logWhatsApp("trip", trip.driverName || "Driver", trip.driverPhone, brief, trip.orderId)}><MessageCircle strokeWidth={1.75} /></a></Button>}
          {!delivered && <Button variant="ghost" size="icon" aria-label="Edit trip" onClick={onEdit}><Pencil strokeWidth={1.75} /></Button>}
          {trip.status === "planned" && <Button variant="ghost" size="icon" aria-label="Remove trip" onClick={() => { removeTrip(trip.id); toast("Trip removed"); }}><Trash2 strokeWidth={1.75} /></Button>}
        </div>
      </div>

      {trip.loading.length > 0 && (
        <div className="mt-3">
          <p className="tnum mb-1 flex justify-between text-xs text-text-muted"><span>Loading checklist</span><span>{ticked} of {trip.loading.length} loaded</span></p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {trip.loading.map((l, i) => (
              <li key={i}>
                <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface-muted/60", l.done && "text-text-muted line-through", delivered && "cursor-default")}>
                  <input type="checkbox" className="size-5 shrink-0 accent-[var(--color-primary)]" checked={l.done} disabled={trip.status === "dispatched" || delivered} onChange={() => tick(i)} />
                  {l.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {delivered ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="size-5 shrink-0" strokeWidth={1.75} />
          <span className="flex-1">Delivered at the venue{trip.deliveredAt && `, ${new Date(trip.deliveredAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}</span>
          {trip.proofPath && <a href={mediaUrl(trip.proofPath)} target="_blank" rel="noreferrer"><img src={mediaUrl(trip.proofPath)} alt="Delivery photo" className="size-14 rounded-lg object-cover" /></a>}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trip.status === "dispatched" ? (
            <>
              <PhotoButton variant="primary" label="Photo and confirm delivery" onUploaded={(path) => advance(path)} />
              <Button variant="ghost" onClick={() => advance()}>Confirm without photo</Button>
            </>
          ) : (
            <Button variant={trip.status === "loading" ? "primary" : "secondary"} disabled={trip.status === "loading" && !allTicked} onClick={() => advance()}>{tripNext[trip.status]}</Button>
          )}
          {trip.status === "loading" && !allTicked && <span className="text-sm text-text-muted">Tick every line to dispatch</span>}
          {step > 0 && <Button variant="ghost" onClick={() => patchTrip(trip.id, { status: tripFlow[step - 1] })}>Back a step</Button>}
        </div>
      )}
    </Card>
  );
}

/** Trips for one function, with the button that plans the next one. */
export function FunctionTrips({ order, fn, showHead = true }: { order: Order; fn: EventFunction; showHead?: boolean }) {
  const trips = useOps((s) => s.trips).filter((t) => t.functionId === fn.id);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const loadList = useLoadList(fn);
  const [draft, setDraft] = React.useState<TripDraft | null>(null);
  const plan = () => setDraft({ orderId: order.id, functionId: fn.id, driverName: "", driverPhone: "", departTime: departBefore(fn.time), status: "planned", cost: 0, loading: trips.length ? [] : loadList(), notes: "" });
  return (
    <section>
      {showHead && (
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-heading text-lg font-semibold">{client?.name} · {fn.name}</h3>
            <p className="tnum flex flex-wrap gap-x-3 text-sm text-text-muted"><span>Serve {fmtTime(fn.time)}</span><span>{num(fn.pax)} guests</span><span className="inline-flex items-center gap-1"><MapPin className="size-3.5" strokeWidth={1.75} />{fn.venue}</span></p>
          </div>
          <Button onClick={plan}><Plus strokeWidth={1.75} />Plan a trip</Button>
        </div>
      )}
      {trips.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4 text-sm text-text-muted">
          No trip planned yet. The first trip starts with every dish, the cutlery and the standard kit on its list.
          {!showHead && <Button onClick={plan}><Plus strokeWidth={1.75} />Plan a trip</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((t) => <TripCard key={t.id} trip={t} fn={fn} venue={fn.venue} onEdit={() => setDraft(t)} />)}
          {!showHead && <Button variant="ghost" onClick={plan}><Plus strokeWidth={1.75} />Another trip</Button>}
        </div>
      )}
      {draft && <TripSheet key={draft.id ?? "new"} draft={draft} onClose={() => setDraft(null)} />}
    </section>
  );
}
