"use client";

import * as React from "react";
import { useStore } from "./store";
import type { EventFunction, QuoteDraft } from "./types";
import { firstEventType } from "./event-types";
import { sessionFor } from "./services";
import { uid } from "./utils";

export function blankFunction(name = "Main function", date = "", pax = 200, venue = "", slot: Partial<EventFunction> = {}): EventFunction {
  const time = slot.time ?? "19:00";
  return { id: uid(), name, date, time, endTime: slot.endTime ?? "22:00", session: sessionFor(time), venue, pax, itemIds: [], foodTypeId: slot.foodTypeId };
}

export function blankDraft(): QuoteDraft {
  return { clientName: "", clientPhone: "", eventType: firstEventType(), functions: [blankFunction()], extras: [], discount: { type: "amount", value: 0 }, step: 0 };
}

/**
 * Work-in-progress quotation, autosaved under `key` so it can be reopened from the same point.
 * `fresh` builds the starting draft; pass `resume: false` to ignore a saved draft (e.g. when starting from an enquiry).
 */
export function useQuoteDraft(key: string, fresh: () => QuoteDraft, resume = true) {
  const saveDraft = useStore((s) => s.saveDraft);
  const [draft, setDraftState] = React.useState<QuoteDraft>(() => (resume && useStore.getState().drafts[key]) || fresh());
  const [resumed] = React.useState(() => resume && !!useStore.getState().drafts[key]);
  const touched = React.useRef(false);

  const setDraft = React.useCallback((patch: Partial<QuoteDraft> | ((d: QuoteDraft) => Partial<QuoteDraft>)) => {
    touched.current = true;
    setDraftState((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  }, []);

  React.useEffect(() => {
    if (touched.current) saveDraft(key, draft);
  }, [draft, key, saveDraft]);

  const clear = React.useCallback(() => {
    touched.current = false;
    saveDraft(key, null);
  }, [key, saveDraft]);

  const restart = React.useCallback(() => {
    clear();
    setDraftState(fresh());
  }, [clear, fresh]);

  return { draft, setDraft, clear, restart, resumed };
}

/** The name a service shows when none is typed: its food type, else "Service 3". */
export const serviceName = (f: Pick<EventFunction, "name" | "foodTypeId">, index: number, foodTypes: { id: string; name: string }[]) =>
  f.name.trim() || foodTypes.find((t) => t.id === f.foodTypeId)?.name || `Service ${index + 1}`;

/** Services with every blank name filled in, so an unnamed service never holds up a booking. */
export const namedServices = (functions: EventFunction[], foodTypes: { id: string; name: string }[]) =>
  functions.map((f, i) => (f.name.trim() ? f : { ...f, name: serviceName(f, i, foodTypes) }));

/** Services with no dishes and no package yet. Not an error (the menu can follow later) but worth a look before saving. */
export const emptyServices = (functions: EventFunction[]) => functions.filter((f) => !f.itemIds.length && !f.packageId).map((f, i) => f.name.trim() || `Service ${i + 1}`);

export function draftIssues(d: QuoteDraft) {
  const issues: string[] = [];
  if (!d.clientName.trim()) issues.push("Enter the client's name");
  if (d.clientPhone.replace(/\D/g, "").length < 10) issues.push("Enter a 10-digit mobile number");
  // Names are filled in automatically when blank, so only a date and guests are needed per service.
  d.functions.forEach((f, i) => {
    const name = f.name.trim() || `Service ${i + 1}`;
    if (!f.date) issues.push(`Pick a date for ${name}`);
    if (!f.pax) issues.push(`Enter guests for ${name}`);
  });
  return issues;
}
