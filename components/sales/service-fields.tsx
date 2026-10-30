"use client";

import { Clock, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { PaxInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, TimeInput } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { blankFunction } from "@/lib/draft";
import { nextSlot, serviceLine, sessionFor, sessions, useFoodTypes } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { EventFunction, Session } from "@/lib/types";
import { addDays, isoDate, parseDate } from "@/lib/utils";
import { DateAvailability } from "./enquiry-sheet";

interface CardProps {
  fn: EventFunction;
  index: number;
  onChange: (patch: Partial<EventFunction>) => void;
  onRemove?: () => void;
  /** First and last day of the event; the date picker stays inside them */
  minDate?: string;
  maxDate?: string;
  showErrors?: boolean;
  /** Placeholder for the name, e.g. "Wedding lunch" */
  namePlaceholder?: string;
}

/** One catering service: food type, name, date, start and end time, session, guests and venue. */
export function ServiceCard({ fn, index, onChange, onRemove, minDate, maxDate, showErrors, namePlaceholder }: CardProps) {
  const foodTypes = useFoodTypes();
  const packages = useStore((s) => s.packages);
  const ready = useStore((s) => s.servicesReady);

  const pickFoodType = (foodTypeId: string) => {
    const before = foodTypes.find((t) => t.id === fn.foodTypeId)?.name;
    const next = foodTypes.find((t) => t.id === foodTypeId);
    // The name follows the food type until someone types their own.
    const generic = !fn.name.trim() || fn.name === before || /^(Main function|Service \d+|Function \d+)$/.test(fn.name);
    const pkg = packages.find((p) => p.id === fn.packageId);
    onChange({
      foodTypeId: foodTypeId || undefined,
      ...(generic && next ? { name: next.name } : {}),
      // A package made for another food type no longer fits.
      ...(pkg?.foodTypeId && pkg.foodTypeId !== foodTypeId ? { packageId: undefined } : {}),
    });
  };

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold">Service {index + 1}{fn.name ? <span className="font-normal text-text-muted"> · {fn.name}</span> : null}</h3>
          <p className="tnum mt-0.5 flex items-center gap-1 text-xs text-text-muted"><Clock className="size-3.5" strokeWidth={1.75} />{serviceLine(fn, foodTypes) || "Set the food type and timings"}</p>
        </div>
        {onRemove && <Button variant="ghost" size="icon" aria-label={`Remove ${fn.name || `service ${index + 1}`}`} onClick={onRemove}><Trash2 strokeWidth={1.75} /></Button>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Food Service Name" className="col-span-2" hint={ready ? undefined : "Saved once the 0012 database update is run."}>
          <Select value={fn.foodTypeId ?? ""} onChange={(e) => pickFoodType(e.target.value)}>
            <option value="">Choose food service</option>
            {foodTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Event Name" className="col-span-2" hint={fn.name.trim() ? undefined : "Left blank, it is named after its food service."}>
          <Input value={fn.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={namePlaceholder ?? (foodTypes.find((t) => t.id === fn.foodTypeId)?.name || `Service ${index + 1}`)} />
        </Field>
        <Field label="Date" className="col-span-2 sm:col-span-1" error={showErrors && !fn.date ? "Pick a date" : ""}>
          <Input type="date" min={minDate || isoDate(new Date())} max={maxDate || undefined} value={fn.date} onChange={(e) => onChange({ date: e.target.value })} />
        </Field>
        <Field label="Start time">
          <TimeInput label="Start time" value={fn.time} onChange={(v) => onChange({ time: v, session: v ? sessionFor(v) : fn.session })} />
        </Field>
        <Field label="End time">
          <TimeInput label="End time" optional value={fn.endTime ?? ""} onChange={(v) => onChange({ endTime: v || undefined })} />
        </Field>
        <Field label="Session" className="col-span-2 sm:col-span-1">
          <Select value={fn.session ?? sessionFor(fn.time)} onChange={(e) => onChange({ session: e.target.value as Session })}>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </Field>
      </div>
      <DateAvailability date={fn.date} pax={fn.pax} />

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">Guests</span>
          <PaxInput value={fn.pax} onChange={(pax) => onChange({ pax })} compact />
        </div>
        <Field label="Venue">
          <Input value={fn.venue} onChange={(e) => onChange({ venue: e.target.value })} placeholder="Hall, lawn or address" />
        </Field>
      </div>
    </Card>
  );
}

/** A new service after the last one: same day, guests and venue, starting an hour after it ends. */
export function nextService(list: EventFunction[], fallback: { date: string; pax: number; venue: string }, lastDay?: string) {
  const last = list[list.length - 1];
  const slot = nextSlot(last);
  let date = last?.date ?? fallback.date;
  // Late in the day it moves to the next morning, but never past the event's last day.
  if (slot.nextDay && date) {
    const next = isoDate(addDays(parseDate(date), 1));
    if (!lastDay || next <= lastDay) date = next;
    else Object.assign(slot, { time: "12:00", endTime: "15:00" });
  }
  return blankFunction("", date, last?.pax ?? fallback.pax, last?.venue ?? fallback.venue, slot);
}

/** The list of services with an Add button, for the enquiry form. */
export function ServiceList({ value, onChange, start, end, fallback, showErrors }: { value: EventFunction[]; onChange: (next: EventFunction[]) => void; start: string; end?: string; fallback: { date: string; pax: number; venue: string }; showErrors?: boolean }) {
  const set = (id: string, patch: Partial<EventFunction>) => onChange(value.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      {value.map((f, i) => (
        <ServiceCard key={f.id} fn={f} index={i} onChange={(p) => set(f.id, p)} onRemove={value.length > 1 ? () => onChange(value.filter((x) => x.id !== f.id)) : undefined} minDate={start} maxDate={end && end > start ? end : start} showErrors={showErrors} />
      ))}
      <Button onClick={() => onChange([...value, nextService(value, fallback, end && end > start ? end : start)])}><Plus strokeWidth={1.75} />Add another service</Button>
    </div>
  );
}
