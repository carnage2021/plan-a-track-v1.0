"use client";

import * as React from "react";
import { roots } from "./categories";
import { useStore } from "./store";
import type { EventFunction, FoodType, MenuCategory, Session } from "./types";
import { addDays, fmtTime, isoDate, parseDate } from "./utils";

// Catering services: an event can have several on one day (welcome drinks at 6, dinner at 9), each with
// a food type that decides which menu categories and packages are offered, a session and its timings.

export const sessions: { id: Session; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
];

export const sessionLabel = (s?: Session) => sessions.find((x) => x.id === s)?.label ?? "";

/** The session a start time falls in: morning from 5, afternoon from 12, evening from 4 pm, night from 8 pm. */
export function sessionFor(time: string): Session {
  const h = Number(time.split(":")[0]);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 16) return "afternoon";
  if (h >= 16 && h < 20) return "evening";
  return "night";
}

/** "6 pm to 7 pm", or just the start when there is no end time. */
export const timeRange = (f: Pick<EventFunction, "time" | "endTime">) => (f.endTime ? `${fmtTime(f.time)} to ${fmtTime(f.endTime)}` : fmtTime(f.time));

/** Starting food types, matched to the account's own categories by name. */
const starters: { id: string; name: string; match?: RegExp; skip?: RegExp }[] = [
  { id: "welcome-drinks", name: "Welcome Drinks", match: /drink|beverage|mocktail|juice|welcome|sharbat|shake/i },
  { id: "breakfast", name: "Breakfast", match: /breakfast|nasta|snack|farsan|drink|beverage|tea|sweet|bakery/i },
  { id: "lunch", name: "Lunch" },
  { id: "high-tea", name: "High Tea", match: /snack|starter|chaat|farsan|tea|drink|beverage|sweet|dessert|bakery/i },
  { id: "snacks", name: "Snacks", match: /snack|starter|chaat|farsan|live/i },
  { id: "gala-dinner", name: "Gala Dinner", skip: /drink|beverage|mocktail|welcome/i },
];

export function defaultFoodTypes(all: MenuCategory[]): FoodType[] {
  // Food types pick top-level categories; their sub-categories come with them.
  const categories = roots(all);
  return starters.map((s) => {
    const ids = categories.filter((c) => (s.match ? s.match.test(c.name) || s.match.test(c.id) : true) && !(s.skip && (s.skip.test(c.name) || s.skip.test(c.id)))).map((c) => c.id);
    return { id: s.id, name: s.name, categoryIds: ids.length ? ids : categories.map((c) => c.id) };
  });
}

/** The account's food types, or the starting list until the owner edits them. */
export function useFoodTypes(): FoodType[] {
  const saved = useStore((s) => s.tenant.foodTypes);
  const categories = useStore((s) => s.categories);
  return React.useMemo(() => (saved?.length ? saved : defaultFoodTypes(categories)), [saved, categories]);
}

/** "Gala Dinner · Night · 9 pm to 11 pm" */
export function serviceLine(f: Pick<EventFunction, "foodTypeId" | "session" | "time" | "endTime">, foodTypes: FoodType[]) {
  return [foodTypes.find((t) => t.id === f.foodTypeId)?.name, sessionLabel(f.session), timeRange(f)].filter(Boolean).join(" · ");
}

/** Every date from start to end, inclusive; just the start when there is no end. */
export function datesBetween(start: string, end?: string) {
  if (!start) return [];
  const out = [start];
  if (!end || end <= start) return out;
  for (let d = parseDate(start); out.length < 60; ) {
    d = addDays(d, 1);
    const iso = isoDate(d);
    if (iso > end) break;
    out.push(iso);
  }
  return out;
}

/** First and last date across a set of services, for "1 Nov to 3 Nov". */
export function eventSpan(functions: Pick<EventFunction, "date">[]) {
  const dates = functions.map((f) => f.date).filter(Boolean).sort();
  return { start: dates[0] ?? "", end: dates[dates.length - 1] ?? "" };
}

/** A start time an hour after the last service ends, for the next service added the same day. */
export function nextSlot(last?: Pick<EventFunction, "time" | "endTime">) {
  if (!last) return { time: "19:00", endTime: "22:00" };
  const from = last.endTime || last.time;
  const [h, m] = from.split(":").map(Number);
  const pad = (n: number) => String(n % 24).padStart(2, "0");
  return { time: `${pad(h + 1)}:${String(m).padStart(2, "0")}`, endTime: `${pad(h + 3)}:${String(m).padStart(2, "0")}` };
}
