import { byName, isWithin, lineage, roots } from "./categories";
import { additionLine } from "./packages";
import { sessionLabel } from "./services";
import type { Client, EventFunction, FoodType, Letterhead, MenuCategory, MenuItem, MenuPackage, Tenant } from "./types";
import { parseDate } from "./utils";

// The event menu on the caterer's letterhead (Order → Documents). This file turns a booking into the document's
// data; components/documents/letterhead-menu.tsx draws it and splits it into A4 pages.

/** The spec's maroon and gold, used until the caterer picks their own colours. */
export const LH_PRIMARY = "#2E000F";
export const LH_ACCENT = "#E3CD7E";

/** A starting letterhead filled from the business details in Settings. */
export function defaultLetterhead(tenant: Pick<Tenant, "phone" | "email" | "address" | "tagline">): Letterhead {
  // The address split near its middle comma, so it sits on two even lines in the footer.
  const parts = (tenant.address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  let cut = 0;
  for (let i = 1, len = 0, total = parts.join(", ").length; i < parts.length; i++) {
    len += parts[i - 1].length + 2;
    if (len >= total / 2) { cut = i; break; }
  }
  const address = cut ? `${parts.slice(0, cut).join(", ")},\n${parts.slice(cut).join(", ")}` : parts.join(", ");
  return { style: "designed", tagline: tenant.tagline ?? "", phones: tenant.phone ?? "", email: tenant.email ?? "", address, primary: LH_PRIMARY, accent: LH_ACCENT, top: 45, bottom: 30, side: 18 };
}

/** The colours of the document. The spec's own shades with its gold; mixed from the accent for any other. */
export function lhTokens(lh: Pick<Letterhead, "primary" | "accent">) {
  const primary = lh.primary || LH_PRIMARY;
  const accent = lh.accent || LH_ACCENT;
  const spec = accent.toUpperCase() === LH_ACCENT;
  const mix = (pct: number, other: string) => `color-mix(in srgb, ${accent} ${pct}%, ${other})`;
  return {
    primary,
    accent,
    rule: spec ? "#CDB46A" : mix(85, "#000"),
    // Labels on white must stay readable, so they are much darker than the accent.
    label: spec ? "#8A6A1F" : mix(55, "#000"),
    ink: "#2B1A1D",
    inkSoft: "#4A2F33",
    cream: spec ? "#FBF6EA" : mix(12, "#fff"),
    hairline: spec ? "#EFE4C8" : mix(30, "#fff"),
    divider: spec ? "#EADBB5" : mix(45, "#fff"),
    ivory: "#F4ECDB",
  };
}
export type LhTokens = ReturnType<typeof lhTokens>;

export interface LhGroup { sub?: string; items: string[] }
export interface LhRow { key: string; label: string; groups: LhGroup[]; oneCol: boolean }
export interface LhEvent {
  id: string;
  /** "Lunch Menu" */
  title: string;
  /** "Menu · Reception" */
  eyebrow: string;
  date: string;
  session: string;
  time: string;
  guests: string;
  venue: string;
  rows: LhRow[];
}
export interface LhBooking {
  party: string;
  date: string;
  functions: string[];
  contactName: string;
  contactPhone: string;
  emails: string[];
  venue: [string, string];
  residing: string;
  events: LhEvent[];
  /** "ShyamCaterers_Zeppelin_Lunch_06-Nov2026" */
  fileName: string;
}

/** "06 Nov 2026" */
export const lhDate = (iso: string) => (iso ? parseDate(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
/** "12:00 PM" */
const clock = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const timeSpan = (f: Pick<EventFunction, "time" | "endTime">) => [clock(f.time), clock(f.endTime)].filter(Boolean).join(" – ");

/** A category with more dishes than a page can hold is split into parts, the later ones marked "(cont.)". */
const PER_ROW = { two: 36, one: 22 };

/**
 * The booking as the letterhead menu shows it: the client and venue for the cover, and each event's dishes by
 * top-level category (A to Z), with a sub-heading for each sub-category below it.
 */
export function letterheadBooking(o: {
  number: string;
  functions: EventFunction[];
  client?: Client;
  items: MenuItem[];
  categories: MenuCategory[];
  packages: MenuPackage[];
  foodTypes: FoodType[];
  brand: string;
}): LhBooking {
  const fns = [...o.functions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const meal = (f: EventFunction) => o.foodTypes.find((t) => t.id === f.foodTypeId)?.name || f.name || "Event";
  const events: LhEvent[] = fns.map((f) => {
    const picked = f.itemIds.map((id) => o.items.find((i) => i.id === id)).filter((i): i is MenuItem => !!i);
    const rows: LhRow[] = [];
    const children = (id: string) => o.categories.filter((c) => c.parentId === id).sort(byName);
    // One row: its dishes straight in the category first, then each category under it as an italic sub-heading.
    const addRows = (label: string, parentId: string, dishes: MenuItem[]) => {
      const kids = children(parentId);
      const flat: { sub?: string; name: string }[] = [
        ...dishes.filter((i) => !kids.some((k) => isWithin(i.categoryId, k.id))).sort(byName).map((i) => ({ name: i.name })),
        ...kids.flatMap((k) => dishes.filter((i) => lineage(i.categoryId).includes(k.id)).sort(byName).map((i) => ({ sub: k.name, name: i.name }))),
      ];
      const oneCol = flat.some((x) => x.name.length > 28);
      const per = oneCol ? PER_ROW.one : PER_ROW.two;
      for (let at = 0, part = 0; at < flat.length; at += per, part++) {
        const groups: LhGroup[] = [];
        for (const x of flat.slice(at, at + per)) {
          const last = groups.at(-1);
          if (last && last.sub === x.sub) last.items.push(x.name);
          else groups.push({ sub: x.sub, items: [x.name] });
        }
        rows.push({ key: `${parentId}-${part}`, label: part ? `${label} (cont.)` : label, groups, oneCol });
      }
    };
    // A category with sub-categories gives a row to each (Live counter › Pebble cooking › The Art of Stone reads
    // "PEBBLE COOKING" with "The Art of Stone" under it); one without is a row of its own. A to Z throughout.
    for (const root of roots(o.categories)) {
      const inRoot = picked.filter((i) => isWithin(i.categoryId, root.id));
      if (!inRoot.length) continue;
      const subs = children(root.id);
      const direct = inRoot.filter((i) => !subs.some((s) => isWithin(i.categoryId, s.id)));
      if (direct.length) addRows(root.name, root.id, direct);
      for (const s of subs) {
        const inSub = inRoot.filter((i) => isWithin(i.categoryId, s.id));
        if (inSub.length) addRows(s.name, s.id, inSub);
      }
    }
    // Dishes whose category is gone still belong on the menu.
    const loose = picked.filter((i) => !o.categories.some((c) => isWithin(i.categoryId, c.id)));
    if (loose.length) rows.push({ key: "other", label: "Also served", groups: [{ items: loose.map((i) => i.name).sort() }], oneCol: loose.some((i) => i.name.length > 28) });
    const extras = (o.packages.find((p) => p.id === f.packageId)?.additions ?? []).filter((a) => a.name.trim()).map(additionLine);
    if (extras.length) rows.push({ key: "additions", label: "Also included", groups: [{ items: extras }], oneCol: extras.some((x) => x.length > 28) });
    const title = meal(f);
    return {
      id: f.id,
      title: /menu$/i.test(title) ? title : `${title} Menu`,
      // "Service 1" is only the stand-in for an unnamed event, so it is left off.
      eyebrow: f.name && f.name !== title && !/^service \d+$/i.test(f.name.trim()) ? `Menu · ${f.name}` : "Menu",
      date: lhDate(f.date),
      session: sessionLabel(f.session),
      time: timeSpan(f),
      guests: f.pax ? `${f.pax} Persons` : "",
      venue: f.venue,
      rows,
    };
  });
  const days = [...new Set(fns.map((f) => f.date).filter(Boolean))].sort();
  const date = days.length > 1 ? `${lhDate(days[0])} – ${lhDate(days.at(-1)!)}` : lhDate(days[0] ?? "");
  // The venue on two lines, split at its first comma: "Alembic Campus" / "Alembic Road, Vadodara".
  const v = fns.find((f) => f.venue.trim())?.venue.trim() ?? "";
  const cut = v.indexOf(",");
  const venue: [string, string] = cut > 0 ? [v.slice(0, cut).trim(), v.slice(cut + 1).trim()] : [v, ""];
  const c = o.client;
  const squash = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "");
  const first = fns[0];
  return {
    party: c?.name ?? "",
    date,
    functions: fns.map((f) => [meal(f), timeSpan(f), f.pax ? `${f.pax} Persons` : ""].filter(Boolean).join(" · ")),
    contactName: c?.name ?? "",
    contactPhone: [c?.phone, c?.altPhone].filter(Boolean).join(" · "),
    emails: (c?.email ?? "").split(/[,;\s]+/).filter(Boolean),
    venue,
    residing: c?.address ?? "",
    events,
    fileName: [squash(o.brand), squash(c?.name ?? o.number), squash(fns.length === 1 && first ? meal(first) : "Menu"), first?.date ? lhDate(first.date).replace(" ", "-").replace(" ", "") : ""].filter(Boolean).join("_"),
  };
}

/** A made-up booking for the preview in Settings and the sample PDF. */
export function sampleBooking(brand: string): LhBooking {
  const row = (label: string, groups: LhGroup[]): LhRow => ({ key: label, label, groups, oneCol: groups.some((g) => g.items.some((x) => x.length > 28)) });
  return {
    party: "Zeppelin Systems India Pvt Ltd",
    date: "06 Nov 2026",
    functions: ["Lunch · 12:00 PM – 02:00 PM · 125 Persons"],
    contactName: "Ms. Hinal Suthar",
    contactPhone: "+91 79931 53931",
    emails: ["hinal.suthar@zeppelin.com", "dharmesh.gohil@zeppelin.com"],
    venue: ["Alembic Campus", "Alembic Road, Vadodara"],
    residing: "Level 4, ADM Building, Alembic Campus, Alembic Road, Vadodara",
    fileName: `${brand.replace(/[^\p{L}\p{N}]+/gu, "")}_Sample_Lunch_06-Nov2026`,
    events: [{
      id: "sample",
      title: "Lunch Menu",
      eyebrow: "Menu · Tent card 5",
      date: "06 Nov 2026",
      session: "Noon",
      time: "12:00 – 02:00 PM",
      guests: "125 Persons",
      venue: "Alembic Campus",
      rows: [
        row("Pebble cooking", [{ sub: "The Art of Stone", items: ["Himalayan Salt Pebble Roasted Sweet Corn", "Smoked Cottage Cheese Schezwan Pepper", "Spicy Tangy Edamame"] }]),
        row("Sarafa bazaar", [{ items: ["Haridwar Ki Tikki", "Sorbet Dahi Bhalla with Kunafa Twist"] }]),
        row("Traditional counter", [{ sub: "Gujarati Steam Counter", items: ["Tam Tam Khaman", "Sp. Vagharela Patra", "Veg. Muthiya", "Khandvi", "Surati Idada", "Green Chutney", "Fry Marcha"] }]),
        row("Sweet", [{ items: ["Keri No Ras", "Tuvar Dal Vedmi"] }]),
        row("Farsan", [{ items: ["Surati Patties"] }]),
        row("Chutney", [{ items: ["Red Chutney", "Green Chutney"] }]),
        row("Paneer prep.", [{ items: ["Awadhi Kofta"] }]),
        row("Veg prep.", [{ items: ["Surati Undhiyu", "Malabari Sev", "Kurkuri Bhindi"] }]),
        row("Dal", [{ items: ["Dal Tadka", "Kadhi"] }]),
        row("Rice prep.", [{ items: ["Jeera Rice", "Peas Rice"] }]),
        row("Breads", [{ items: ["Phulka Roti", "Puri"] }]),
        row("Papad", [{ items: ["Roasted Papad", "Mathiya"] }]),
        row("Pickle", [{ items: ["Pickle"] }]),
        row("Salad", [{ items: ["Green Salad", "Corn Peanut Salad"] }]),
        row("Drinking water", [{ items: ["200 ml Water Bottles"] }]),
        row("Paan counter", [{ items: ["Sindoda Paan", "Calcutta Paan", "Pineapple Paan"] }]),
        row("Dessert", [{ sub: "Assorted Ice Cream", items: ["Tacos with Pista Ice Cream", "Biscoff Ice Cream", "Golden Crunch Roll Cut"] }]),
      ],
    }],
  };
}

/** Phone numbers typed one per line (or with commas). */
export const phoneList = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
/** The address's two lines. */
export const addressLines = (s: string): [string, string] => {
  const [a = "", ...rest] = s.split(/\n/).map((x) => x.trim()).filter(Boolean);
  return [a, rest.join(", ")];
};
