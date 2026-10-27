"use client";

import { useStore } from "./store";

// The kinds of event a caterer takes on. Each account keeps its own list (Settings, Event types, or the Import
// page); until it has one, the standard list below is offered.

export const standardEventTypes = ["Wedding", "Engagement", "Reception", "Birthday", "Anniversary", "Baby Shower", "Housewarming", "Corporate", "Religious", "Other"];

export interface EventType { id: string; name: string }

/** Names to offer in the forms: the account's own list, or the standard one while it has none. */
export function useEventTypes(): string[] {
  const own = useStore((s) => s.eventTypes);
  return own.length ? own.map((e) => e.name) : standardEventTypes;
}

/** The first event type, used to start a new enquiry or quotation. */
export const firstEventType = () => useStore.getState().eventTypes[0]?.name ?? standardEventTypes[0];
