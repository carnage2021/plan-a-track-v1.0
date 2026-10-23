import type { Locale } from "./types";

// The Hindu lunar day (tithi) for a calendar date, as it stands at sunrise in India (taken as 6:30 am IST),
// which is the tithi a panchang lists for that day. Worked out from the Moon's angle ahead of the Sun:
// every 12 degrees is one tithi, 1 to 15 in the bright half (Shukla, "Sud") and 16 to 30 in the dark half
// (Krishna, "Vad"). The positions use the standard short series from Meeus' Astronomical Algorithms,
// good to a few minutes of arc, so a tithi that changes within about half an hour of sunrise can differ
// from a printed panchang by one day.

const rad = Math.PI / 180;
const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** Angle of the Moon ahead of the Sun, in degrees, at a moment given as days since J2000.0. */
export function elongation(d: number) {
  const L = 218.3164477 + 13.17639648 * d; // Moon's mean longitude
  const D = (297.8501921 + 12.19074912 * d) * rad; // mean elongation
  const M = (357.5291092 + 0.98560028 * d) * rad; // Sun's mean anomaly
  const Mm = (134.9633964 + 13.06499295 * d) * rad; // Moon's mean anomaly
  const F = (93.272095 + 13.22935024 * d) * rad; // Moon's argument of latitude
  const moon =
    L +
    6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * D - Mm) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F) +
    0.059 * Math.sin(2 * D - 2 * Mm) + 0.057 * Math.sin(2 * D - M - Mm) + 0.053 * Math.sin(2 * D + Mm) + 0.046 * Math.sin(2 * D - M) + 0.041 * Math.sin(Mm - M) -
    0.035 * Math.sin(D) - 0.03 * Math.sin(Mm + M);
  return norm(moon - sunLongitude(d));
}

/** The Sun's tropical longitude in degrees, days since J2000.0. */
export function sunLongitude(d: number) {
  const M = (357.5291092 + 0.98560028 * d) * rad;
  return norm(280.46646 + 0.98564736 * d + 1.914602 * Math.sin(M) + 0.019993 * Math.sin(2 * M));
}

/** Days since J2000.0 for an Indian clock time (IST) on an ISO date. */
export function daysAt(isoDate: string, hourIst = 6.5) {
  const [y, m, day] = isoDate.split("-").map(Number);
  return (Date.UTC(y, m - 1, day) + (hourIst - 5.5) * 3600000) / 86400000 + 2440587.5 - 2451545.0;
}

/** Tithi number 1 to 30 at a given moment, days since J2000.0. */
export const tithiAt = (d: number) => Math.floor(elongation(d) / 12) + 1;

/** Tithi number 1 to 30 at sunrise on an ISO date (YYYY-MM-DD). */
export function tithiOn(isoDate: string) {
  return tithiAt(daysAt(isoDate));
}

const names = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi"];

const words: Record<Locale, { sud: string; vad: string; purnima: string; amas: string; ekadashi: string; digits?: string }> = {
  en: { sud: "Sud", vad: "Vad", purnima: "Purnima", amas: "Amas", ekadashi: "Ekadashi" },
  hi: { sud: "शुक्ल", vad: "कृष्ण", purnima: "पूर्णिमा", amas: "अमावस्या", ekadashi: "एकादशी", digits: "०१२३४५६७८९" },
  gu: { sud: "સુદ", vad: "વદ", purnima: "પૂનમ", amas: "અમાસ", ekadashi: "અગિયારસ", digits: "૦૧૨૩૪૫૬૭૮૯" },
};

export interface Tithi {
  /** 1 to 30 */
  n: number;
  /** Day of the fortnight, 1 to 15 */
  day: number;
  paksha: "shukla" | "krishna";
  /** Short label for a calendar cell, e.g. "Sud 7", "Purnima", "વદ ૧૧" */
  short: string;
  /** Full English name, e.g. "Shukla Saptami" */
  full: string;
  /** Purnima, Amavasya and both Ekadashis are marked on the calendar */
  special: boolean;
}

export function tithiLabel(isoDate: string, locale: Locale = "en"): Tithi {
  const n = tithiOn(isoDate);
  const paksha = n <= 15 ? "shukla" : "krishna";
  const day = n <= 15 ? n : n - 15;
  const w = words[locale] ?? words.en;
  const digits = (v: number) => (w.digits ? String(v).replace(/\d/g, (c) => w.digits![Number(c)]) : String(v));
  const full = n === 15 ? "Purnima" : n === 30 ? "Amavasya" : `${paksha === "shukla" ? "Shukla" : "Krishna"} ${names[day - 1]}`;
  const short = n === 15 ? w.purnima : n === 30 ? w.amas : day === 11 ? w.ekadashi : `${paksha === "shukla" ? w.sud : w.vad} ${digits(day)}`;
  return { n, day, paksha, short, full, special: n === 15 || n === 30 || day === 11 };
}
