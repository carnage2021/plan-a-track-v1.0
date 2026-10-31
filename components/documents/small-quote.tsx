"use client";

import * as React from "react";
import { byDay } from "@/components/sales/event-charges";
import { pricedAtBooking, rootOf } from "@/lib/categories";
import { chargeAmount, priceFunction, priceQuote } from "@/lib/pricing";
import { eventSpan, useFoodTypes } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { Discount, EventFunction, ExtraCharge, MenuItem, MenuPackage } from "@/lib/types";
import { decimal, fmtDate, num } from "@/lib/utils";

export interface SmallQuoteData {
  clientName: string;
  functions: EventFunction[];
  extras: ExtraCharge[];
  discount: Discount;
  gstRate: number;
  gstInclusive: boolean;
  creditUsed?: number;
}

/**
 * How one event's per-plate rate is made up, for the red line under it: the package price and the extra dishes on
 * top, or the dishes course by course (one part per top-level category), then the main course rate.
 */
function rateParts(f: EventFunction, items: MenuItem[], pkg: MenuPackage | undefined, extraIds: string[], mainRate: number) {
  const parts = new Map<string, number>();
  if (pkg) parts.set("package", pkg.pricePerPlate);
  for (const id of f.itemIds) {
    const i = items.find((x) => x.id === id);
    if (!i || i.pricingType !== "plate" || (pkg && !extraIds.includes(id))) continue;
    const price = f.itemPrices?.[id] ?? (pricedAtBooking(i.categoryId) ? 0 : i.price);
    const key = rootOf(i.categoryId);
    parts.set(key, (parts.get(key) ?? 0) + price);
  }
  if (mainRate) parts.set("main", mainRate);
  return [...parts.values()].filter((v) => v > 0);
}

/** Times the way the sheet writes them: 04:00 pm. */
const clock = (t: string) => { const [h, m] = t.split(":").map(Number); return `${String(h % 12 || 12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`; };
const date = (iso: string) => fmtDate(iso, { day: "2-digit", month: "2-digit", year: "2-digit" });
const cell = "border border-black px-1.5 py-1";

/**
 * The small quotation: one plain table the way caterers write it by hand. Each service with its guests, rate per
 * plate and total, then the extra charges (staff, cutlery, counters), the discount, the whole-booking extras after
 * it, and GST. It comes to the same total as the full quotation.
 */
export function SmallQuote({ data }: { data: SmallQuoteData }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const foodTypes = useFoodTypes();
  const totals = priceQuote(data, items, packages, tenant.slabs);
  const span = eventSpan(data.functions);
  const days = byDay(data.functions);

  const food = days.flatMap(([, fns]) => fns.map((f) => {
    const p = priceFunction(f, items, packages, tenant.slabs);
    const parts = rateParts(f, items, packages.find((x) => x.id === f.packageId), p.extraIds, p.mainRate);
    const sum = parts.reduce((s, v) => s + v, 0);
    // The guest-count discount comes off the menu prices, so the split says so when there is one.
    const split = parts.length > 1 ? `(Rs.${parts.map(decimal).join("+")}=${decimal(sum)}${p.perPlate !== sum ? `, less ${p.slabPct}% = ${decimal(p.perPlate)}` : ""}/-)` : "";
    return { f, p, split, name: foodTypes.find((t) => t.id === f.foodTypeId)?.name ?? f.name };
  }));
  const foodCost = food.reduce((s, x) => s + x.p.perPlate * x.f.pax, 0);
  // Counters are priced as a whole, so they sit with the extra charges with just their total.
  const charges = food.flatMap(({ f }) => [
    ...(f.charges ?? []).filter((c) => chargeAmount(c)).map((c) => ({ id: c.id, date: f.date, label: c.kind === "worker" && f.time ? `${c.label} (${clock(f.time)}${f.endTime ? ` To ${clock(f.endTime)}` : ""})` : c.label, qty: c.qty, rate: c.rate, amount: chargeAmount(c) })),
    ...f.itemIds.map((id) => items.find((i) => i.id === id)).filter((i): i is MenuItem => !!i && i.pricingType !== "plate").map((i) => ({ id: `${f.id}-${i.id}`, date: f.date, label: i.name, qty: 0, rate: 0, amount: f.itemPrices?.[i.id] ?? i.price })).filter((c) => c.amount),
  ]);
  const chargeTotal = charges.reduce((s, c) => s + c.amount, 0);
  const after = data.extras.filter((e) => e.amount);
  const gst = data.gstRate > 0 && !data.gstInclusive;

  const blank = <tr><td className={cell}>&nbsp;</td><td className={cell} /><td className={cell} /><td className={cell} /><td className={cell} /></tr>;
  const total = (value: number) => (
    <tr className="font-bold"><td className={cell} /><td className={`${cell} text-right`}>Total</td><td className={cell} /><td className={cell} /><td className={`${cell} text-right text-[20px]`}>{num(value)}</td></tr>
  );
  /** A summary line: the label at the right of Particular, the amount under Pax, as on the hand-made sheet. */
  const line = (label: React.ReactNode, value: number, big = false) => (
    <tr className={big ? "font-bold" : undefined}><td className={cell} /><td className={`${cell} text-right ${big ? "text-[19px]" : ""}`}>{label}</td><td className={`${cell} ${big ? "text-[19px]" : ""}`}>{num(value)}</td><td className={cell} /><td className={cell} /></tr>
  );

  return (
    <article className="tnum bg-white px-[6mm] py-[4mm] text-[15px] leading-tight text-black" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
      <table className="w-full border-collapse border-2 border-black">
        <colgroup><col className="w-[15%]" /><col className="w-[44%]" /><col className="w-[14%]" /><col className="w-[11%]" /><col className="w-[16%]" /></colgroup>
        <thead>
          <tr><th colSpan={5} className={`${cell} text-[20px]`}>{data.clientName} {span.start ? (span.end > span.start ? `${fmtDate(span.start, { day: "numeric", month: "short" })} to ${fmtDate(span.end)}` : fmtDate(span.start)) : ""}</th></tr>
          <tr><th colSpan={5} className={`${cell} text-[24px] underline`}>Quotation</th></tr>
          <tr><th className={cell}>Date</th><th className={cell}>Particular</th><th className={cell}>Pax</th><th className={cell}>Rate</th><th className={cell}>Total</th></tr>
        </thead>
        <tbody>
          {food.map(({ f, p, split, name }) => (
            <React.Fragment key={f.id}>
              <tr><td className={`${cell} text-center`}>{date(f.date)}</td><td className={cell}>{name}</td><td className={`${cell} text-center`}>{num(f.pax)}</td><td className={`${cell} text-center`}>{decimal(p.perPlate)}</td><td className={`${cell} text-right`}>{num(p.perPlate * f.pax)}</td></tr>
              {split && <tr><td className={cell} /><td className={`${cell} text-[#d71920]`}>{split}</td><td className={cell} /><td className={cell} /><td className={cell} /></tr>}
            </React.Fragment>
          ))}
          {total(foodCost)}
        </tbody>
        {charges.length > 0 && (
          <tbody className="break-inside-avoid">
            <tr><td colSpan={5} className={`${cell} text-center text-[22px] font-bold`}>**<span className="underline">EXTRA CHARGES</span>**</td></tr>
            {charges.map((c) => (
              <tr key={c.id}><td className={`${cell} text-center`}>{date(c.date)}</td><td className={cell}>{c.label}</td><td className={`${cell} text-center`}>{c.qty ? decimal(c.qty) : ""}</td><td className={`${cell} text-center`}>{c.rate ? decimal(c.rate) : ""}</td><td className={`${cell} text-right`}>{num(c.amount)}</td></tr>
            ))}
            {blank}
            {total(chargeTotal)}
          </tbody>
        )}
        <tbody className="break-inside-avoid">
          {blank}
          {line("Food Cost", foodCost, true)}
          {charges.length > 0 && line("Extra Charges", chargeTotal, true)}
          {line("Grand Total", foodCost + chargeTotal, true)}
          {totals.discount > 0 && (
            <>
              {blank}
              {line(<span className="text-[19px] font-bold">Discount</span>, totals.discount)}
              {blank}
              {line("Total", foodCost + chargeTotal - totals.discount, true)}
            </>
          )}
          {after.length > 0 && (
            <>
              {blank}
              {after.map((e) => <tr key={e.id}><td className={cell} /><td className={cell}>{e.label}</td><td className={cell}>{num(e.amount)}</td><td className={cell} /><td className={cell} /></tr>)}
            </>
          )}
          {totals.credit > 0 && line("Referral credit", -totals.credit)}
          {gst && line(`GST ${data.gstRate}%`, totals.gst)}
          {(after.length > 0 || totals.credit > 0 || gst) && (
            <>
              {blank}
              {line("Total", totals.grand, true)}
            </>
          )}
        </tbody>
      </table>
      {data.gstRate > 0 && data.gstInclusive && <p className="mt-2 text-center text-[13px]">Rates include GST {data.gstRate}%.</p>}
    </article>
  );
}
