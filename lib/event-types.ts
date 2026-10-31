"use client";

import { useStore } from "./store";

// The kinds of event a caterer takes on. Each account keeps its own list (Settings, Event types, or the Import
// page); until it has one, the standard list below is offered.

export const standardEventTypes = ["Wedding", "Engagement", "Reception", "Birthday", "Anniversary", "Baby Shower", "Housewarming", "Corporate", "Religious", "Other"];

/** The usual sub-events of an event type, suggested as each catering service's Event Name. Same as 0023. */
export const standardSubEvents: Record<string, string[]> = {
  wedding: ["Haldi", "Mehndi", "Sangeet", "Garba", "Mandap Muhurat", "Wedding Day", "Reception"],
  engagement: ["Ring Ceremony", "Engagement Lunch", "Engagement Dinner"],
  reception: ["Reception Dinner", "Cocktail Evening"],
  birthday: ["Cake Cutting", "Birthday Party", "Birthday Lunch"],
  "birthday party": ["Cake Cutting", "Birthday Party", "Birthday Lunch"],
  anniversary: ["Anniversary Dinner", "Anniversary Party"],
  "baby shower": ["Godh Bharai", "Seemant", "Baby Shower Lunch"],
  housewarming: ["Vastu Puja", "Griha Pravesh", "Housewarming Lunch"],
  "griha shanti": ["Griha Shanti Puja", "Griha Shanti Lunch"],
  corporate: ["Conference Lunch", "Annual Day", "Team Dinner", "Product Launch"],
  "corporate lunch": ["Conference Lunch", "Team Lunch"],
  religious: ["Katha", "Satsang", "Bhandara", "Navratri Garba"],
};

export interface EventType { id: string; name: string; subEvents?: string[] }

/** "Haldi; Mehndi, Sangeet" or one per line, as a clean list without repeats. */
export const splitSubEvents = (text: string) => [...new Map(text.split(/[;,\n]/).map((x) => x.trim()).filter(Boolean).map((x) => [x.toLowerCase(), x])).values()];

/** Names to offer in the forms: the account's own list, or the standard one while it has none. */
export function useEventTypes(): string[] {
  const own = useStore((s) => s.eventTypes);
  return own.length ? own.map((e) => e.name) : standardEventTypes;
}

/** The sub-events of an event type: the account's own, else the usual ones for that name. */
export function useSubEvents(eventType?: string): string[] {
  const own = useStore((s) => s.eventTypes.find((e) => e.name.toLowerCase() === (eventType ?? "").trim().toLowerCase())?.subEvents);
  return own?.length ? own : (standardSubEvents[(eventType ?? "").trim().toLowerCase()] ?? []);
}

/** The first event type, used to start a new enquiry or quotation. */
export const firstEventType = () => useStore.getState().eventTypes[0]?.name ?? standardEventTypes[0];
