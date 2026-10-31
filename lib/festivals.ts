import { daysAt, elongation, sunLongitude, tithiAt } from "./tithi";
import { addDays, isoDate, parseDate } from "./utils";

// Indian festivals for the calendar. Most follow the lunar calendar: a festival is a lunar month plus a
// tithi, observed at a particular time of day (Diwali in the evening, Janmashtami at midnight, most at
// sunrise). Months are counted the Gujarati way (amanta, new moon to new moon) and named after the sign
// the Sun is in when the month begins; a month that begins with the Sun still in the same sign is an
// extra (adhik) month, in which festivals are not held.

export const lunarMonths = ["Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada", "Ashwin", "Kartik", "Margashirsha", "Pausha", "Magha", "Phalguna"] as const;
type Month = (typeof lunarMonths)[number];

/** Lahiri ayanamsa, close enough for naming months: about 23.85 degrees in 2000, growing 50.3 arc seconds a year. */
const ayanamsa = (d: number) => 23.853 + (d / 365.25) * 0.013969;
const siderealSun = (d: number) => (((sunLongitude(d) - ayanamsa(d)) % 360) + 360) % 360;

/** Every new moon between two moments, found by stepping a synodic month at a time and refining. */
function newMoons(from: number, to: number) {
  const found: number[] = [];
  // A date half typed in can give no number at all; never search without an end.
  if (!Number.isFinite(from) || !Number.isFinite(to) || to - from > 1000) return found;
  const synodic = 29.530588861;
  let k = Math.floor((from - 6.098) / synodic) - 1; // 2000-01-06 was a new moon
  for (;;) {
    let t = 6.098 + k * synodic;
    for (let i = 0; i < 6; i++) {
      const e = elongation(t);
      t -= (e > 180 ? e - 360 : e) / 12.19;
    }
    if (t > to) break;
    if (t >= from) found.push(t);
    k++;
  }
  return found;
}

interface LunarMonth { start: number; name: Month; adhik: boolean }
const cache = new Map<number, LunarMonth[]>();

/** The lunar months that begin in and around a Gregorian year. */
function monthsAround(year: number) {
  const hit = cache.get(year);
  if (hit) return hit;
  const from = daysAt(`${year - 1}-11-01`);
  const to = daysAt(`${year + 1}-02-28`);
  const moons = newMoons(from, to);
  // Chaitra begins with the Sun in Pisces (sign 11), Vaishakha in Aries, and so on round the zodiac.
  const signs = moons.map((t) => Math.floor(siderealSun(t) / 30));
  const months = moons.map((t, i) => ({ start: t, name: lunarMonths[(signs[i] + 1) % 12], adhik: i + 1 < moons.length && signs[i + 1] === signs[i] }));
  cache.set(year, months);
  return months;
}

/** The lunar month a moment falls in. */
function lunarMonthAt(d: number, year: number) {
  const months = monthsAround(year);
  let current: LunarMonth | undefined;
  for (const m of months) if (m.start <= d) current = m;
  return current;
}

type When = "sunrise" | "noon" | "evening" | "midnight";
const hourOf: Record<When, number> = { sunrise: 6.5, noon: 13, evening: 19, midnight: 23.9 };
interface Rule { name: string; month: Month; tithi: number; at?: When }

/** Krishna-paksha tithis are numbered 16 to 30 within the month that began at the new moon. */
const rules: Rule[] = [
  { name: "Gudi Padwa · Chaitra Navratri", month: "Chaitra", tithi: 1 },
  { name: "Ram Navami", month: "Chaitra", tithi: 9, at: "noon" },
  { name: "Mahavir Jayanti", month: "Chaitra", tithi: 13 },
  { name: "Hanuman Jayanti", month: "Chaitra", tithi: 15 },
  { name: "Akshaya Tritiya", month: "Vaishakha", tithi: 3, at: "noon" },
  { name: "Buddha Purnima", month: "Vaishakha", tithi: 15 },
  { name: "Rath Yatra", month: "Ashadha", tithi: 2 },
  { name: "Devshayani Ekadashi", month: "Ashadha", tithi: 11 },
  { name: "Guru Purnima", month: "Ashadha", tithi: 15 },
  { name: "Nag Panchami", month: "Shravana", tithi: 5 },
  { name: "Raksha Bandhan", month: "Shravana", tithi: 15 },
  { name: "Janmashtami", month: "Shravana", tithi: 23, at: "midnight" },
  { name: "Ganesh Chaturthi", month: "Bhadrapada", tithi: 4, at: "noon" },
  { name: "Anant Chaturdashi", month: "Bhadrapada", tithi: 14 },
  { name: "Navratri begins", month: "Ashwin", tithi: 1 },
  { name: "Dussehra", month: "Ashwin", tithi: 10, at: "noon" },
  { name: "Sharad Purnima", month: "Ashwin", tithi: 15, at: "evening" },
  { name: "Karwa Chauth", month: "Ashwin", tithi: 19, at: "evening" },
  { name: "Dhanteras", month: "Ashwin", tithi: 28, at: "evening" },
  { name: "Kali Chaudas", month: "Ashwin", tithi: 29, at: "evening" },
  { name: "Diwali", month: "Ashwin", tithi: 30, at: "evening" },
  { name: "Gujarati New Year", month: "Kartik", tithi: 1 },
  { name: "Bhai Dooj", month: "Kartik", tithi: 2 },
  { name: "Labh Pancham", month: "Kartik", tithi: 5 },
  { name: "Dev Uthani Ekadashi", month: "Kartik", tithi: 11 },
  { name: "Dev Diwali", month: "Kartik", tithi: 15 },
  { name: "Vasant Panchami", month: "Magha", tithi: 5 },
  { name: "Maha Shivaratri", month: "Magha", tithi: 29, at: "midnight" },
  { name: "Holika Dahan", month: "Phalguna", tithi: 15, at: "evening" },
];

/** Festivals on fixed dates of the year. */
const fixed: Record<string, string> = {
  "01-01": "New Year's Day",
  "01-14": "Uttarayan · Makar Sankranti",
  "01-15": "Vasi Uttarayan",
  "01-26": "Republic Day",
  "05-01": "Gujarat Day",
  "08-15": "Independence Day",
  "10-02": "Gandhi Jayanti",
  "12-25": "Christmas",
};

const cacheDay = new Map<string, string[]>();

/** Festivals are worked out for real calendar years only, not a year still being typed (0002, 0202). */
const plausible = (year: number) => Number.isInteger(year) && year >= 1900 && year <= 2200;

/** Festival names for an ISO date (YYYY-MM-DD). */
export function festivalsOn(iso: string): string[] {
  const hit = cacheDay.get(iso);
  if (hit) return hit;
  const out: string[] = [];
  if (fixed[iso.slice(5)]) out.push(fixed[iso.slice(5)]);
  out.push(...lunarFestivals(iso));
  // Holi (Dhuleti) is the day after Holika Dahan.
  if (lunarFestivals(isoDate(addDays(parseDate(iso), -1))).includes("Holika Dahan")) out.push("Holi · Dhuleti");
  cacheDay.set(iso, out);
  return out;
}

function lunarFestivals(iso: string) {
  const year = Number(iso.slice(0, 4));
  const out: string[] = [];
  if (!plausible(year)) return out;
  const yesterday = isoDate(addDays(parseDate(iso), -1));
  const tomorrow = isoDate(addDays(parseDate(iso), 1));
  for (const r of rules) {
    const hour = hourOf[r.at ?? "sunrise"];
    const now = daysAt(iso, hour);
    const next = daysAt(tomorrow, hour);
    const t = tithiAt(now);
    // The festival day is the first day its tithi holds at the right hour. If the tithi starts and ends
    // between two of those moments (a skipped tithi), the festival falls on the day it began, and the
    // month is the one the tithi belongs to, which may only have begun after that moment.
    const target = r.tithi;
    const prev = target === 1 ? 30 : target - 1;
    const held = t === target && tithiAt(daysAt(yesterday, hour)) !== target;
    const skipped = t === prev && tithiAt(next) === (target % 30) + 1;
    if (!held && !skipped) continue;
    const month = lunarMonthAt(held ? now : next, year);
    if (month && !month.adhik && month.name === r.month) out.push(r.name);
  }
  return out;
}

/** The lunar month for a date, e.g. "Kartik" (amanta). */
export function lunarMonthOn(iso: string) {
  if (!plausible(Number(iso.slice(0, 4)))) return "";
  const m = lunarMonthAt(daysAt(iso), Number(iso.slice(0, 4)));
  return m ? `${m.adhik ? "Adhik " : ""}${m.name}` : "";
}
