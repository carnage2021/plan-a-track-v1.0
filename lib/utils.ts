import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Rupee amount in Indian grouping, e.g. ₹1,25,000 */
export function money(amount: number) {
  return `₹${inr.format(Math.round(amount))}`;
}

export function num(n: number) {
  return inr.format(n);
}

/** Short form for stat cards: ₹4.2L, ₹1.1Cr */
export function moneyShort(amount: number) {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2).replace(/\.?0+$/, "")}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  return money(amount);
}

/** A UUID, usable as a primary key. Falls back to getRandomValues where randomUUID is unavailable (plain http on a LAN). */
export function uid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Local calendar date as yyyy-mm-dd */
export function isoDate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The local calendar day of a database timestamp; slicing the UTC text would give yesterday after midnight in India. */
export function localDay(timestamp: string) {
  return isoDate(new Date(timestamp));
}

export function parseDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function daysFromToday(iso: string) {
  const today = parseDate(isoDate(new Date()));
  return Math.round((parseDate(iso).getTime() - today.getTime()) / 86400000);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  return parseDate(iso).toLocaleDateString("en-IN", opts);
}

export function fmtTime(time: string) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
}

export function relativeDay(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return `In ${n} days`;
  if (n < -1) return `${-n} days ago`;
  return fmtDate(iso, { day: "numeric", month: "short" });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Financial year label for document numbers, e.g. 26-27 (April to March) */
export function financialYear(d = new Date()) {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
