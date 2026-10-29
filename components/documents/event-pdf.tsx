"use client";

import { CalendarDays, Clock, MapPin, UserRound, Users } from "lucide-react";
import * as React from "react";
import { DocHeader, DocPayBlock, docStyle, useDocs } from "@/components/documents/theme";
import { VegMark } from "@/components/shared/badges";
import { byDay } from "@/components/sales/event-charges";
import type { DocumentData } from "@/components/sales/quote-document";
import { isWithin, roots } from "@/lib/categories";
import { dishName, docT } from "@/lib/doc-i18n";
import { additionLine } from "@/lib/packages";
import { chargeAmount, priceFunction, priceQuote } from "@/lib/pricing";
import { useFoodTypes } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { Coordinator, EventFunction, MenuItem } from "@/lib/types";
import { cn, fmtDate, fmtTime, money, num, rate } from "@/lib/utils";

type Variant = "quotation" | "confirmation" | "menu";

/**
 * The quotation, confirmation or menu card as a designed A4 document for the PDF download. Every day starts on a new
 * page under a date banner; each event shows its food service, session, timings, guests, venue, menu by category and
 * (except on the menu card) its own price table and total. The full document ends with a summary page; a day's
 * document (`day`) holds only that day's events with the day total and the whole booking's grand total.
 */
export function EventPdf({ data, variant, day, coordinator }: { data: DocumentData; variant: Variant; day?: string; coordinator?: Coordinator }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const docs = useDocs();
  const t = docT(data.lang ?? "en");
  const showPrices = variant !== "menu";
  const all = byDay(data.functions.filter((f) => f.date));
  const days = all.filter(([d]) => !day || d === day);
  const totals = priceQuote(data, items, packages, tenant.slabs);
  const dayTotal = (fns: EventFunction[]) => fns.reduce((s, f) => s + priceFunction(f, items, packages, tenant.slabs).eventTotal, 0);
  const first = all[0]?.[0], last = all.at(-1)?.[0];
  const long = (d: string) => fmtDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dayNo = (d: string) => all.findIndex(([x]) => x === d) + 1;
  const title = day ? `${t(variant)} · ${t("day")} ${dayNo(day)}` : t(variant);

  return (
    <article className="bg-white text-[12.5px] leading-relaxed text-[#1f1a17]" style={docStyle(tenant.brandColor, docs.theme)}>
      <DocHeader title={title} lines={[data.number ? `${data.number}${data.version && data.version > 1 ? ` · v${data.version}` : ""}` : "", data.date ? `${t("date")}: ${fmtDate(data.date)}` : "", data.validUntil && variant === "quotation" ? `${t("validUntil")}: ${fmtDate(data.validUntil)}` : ""]} contact />

      {/* Who it is for and the shape of the event. */}
      <section className="grid grid-cols-3 gap-4 border-b px-8 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6158]">{t("preparedFor")}</p>
          <p className="font-heading text-base font-semibold">{data.clientName || t("clientName")}</p>
          {data.clientPhone && <p className="tnum text-[#6b6158]">{data.clientPhone}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6158]">{t("event")}</p>
          <p className="font-medium">{data.eventType}</p>
          {first && <p className="tnum text-[#6b6158]">{first === last ? long(first) : `${fmtDate(first, { day: "numeric", month: "short" })} – ${fmtDate(last!, { day: "numeric", month: "short", year: "numeric" })} · ${all.length} ${t("days")}`}</p>}
          <p className="tnum text-[#6b6158]">{data.functions.length} {data.functions.length === 1 ? t("eventOne") : t("events")} · {num(data.functions.reduce((s, f) => s + f.pax, 0))} {t("guests")}</p>
        </div>
        {coordinator?.name ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6158]">{t("coordinator")}</p>
            <p className="font-medium">{coordinator.name}</p>
            <p className="tnum text-[#6b6158]">{[coordinator.phone, coordinator.email].filter(Boolean).join(" · ")}</p>
          </div>
        ) : <div />}
      </section>

      {days.map(([date, fns], i) => (
        <section key={date} className={cn("px-8 pt-5", i > 0 && "break-before-page")}>
          <div className="flex items-center justify-between rounded-lg bg-brand px-4 py-2 text-brand-fg">
            <p className="flex items-center gap-2 font-heading text-[15px] font-semibold"><CalendarDays className="size-4" strokeWidth={2} />{t("day")} {dayNo(date)} · {long(date)}</p>
            <p className="text-xs opacity-90">{fns.length} {fns.length === 1 ? t("eventOne") : t("events")}</p>
          </div>
          {fns.map((f) => <EventBlock key={f.id} f={f} showPrices={showPrices} lang={data.lang ?? "en"} />)}
          {showPrices && fns.length > 1 && (
            <div className="tnum mt-3 flex items-baseline justify-between rounded-lg border-2 border-brand/40 px-4 py-2">
              <span className="font-medium">{t("dayTotal")} <span className="text-xs text-[#6b6158]">({t("beforeTax")})</span></span>
              <span className="font-heading text-base font-bold">{money(dayTotal(fns))}</span>
            </div>
          )}
        </section>
      ))}

      {showPrices && (
        <section className={cn("px-8 pt-6", !day && "break-before-page")}>
          <h2 className="border-b-2 border-brand pb-1 font-heading text-base font-semibold">{t("bookingSummary")}</h2>
          <table className="tnum mt-2 w-full">
            <tbody className="divide-y">
              {(day ? days : all).map(([date, fns]) => (
                <tr key={date}>
                  <td className="py-1.5 pr-3 font-medium">{t("day")} {dayNo(date)} · {fmtDate(date, { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td className="py-1.5 pr-3 text-[#6b6158]">{fns.map((f) => f.name).join(", ")}</td>
                  <td className="py-1.5 text-right">{money(dayTotal(fns))}</td>
                </tr>
              ))}
              {!day && data.extras.filter((e) => e.amount).map((e) => <tr key={e.id}><td className="py-1.5 pr-3" colSpan={2}>{e.label}</td><td className="py-1.5 text-right">{money(e.amount)}</td></tr>)}
            </tbody>
            {day ? (
              <tfoot>
                <tr className="border-t-2"><td className="pt-2 font-medium" colSpan={2}>{t("dayTotal")} <span className="text-xs text-[#6b6158]">({t("beforeTax")})</span></td><td className="pt-2 text-right font-heading text-base font-bold">{money(dayTotal(days[0]?.[1] ?? []))}</td></tr>
                <tr><td className="py-1 text-[#6b6158]" colSpan={2}>{t("wholeBooking")} ({all.length} {all.length === 1 ? t("day").toLowerCase() : t("days")}, {t("gst")} {data.gstRate}%)</td><td className="py-1 text-right text-[#6b6158]">{money(totals.grand)}</td></tr>
              </tfoot>
            ) : (
              <tfoot>
                <tr className="border-t-2"><td className="pt-2 text-[#6b6158]" colSpan={2}>{t("subtotal")}</td><td className="pt-2 text-right">{money(totals.subtotal)}</td></tr>
                {totals.discount > 0 && <tr><td className="py-1 text-[#6b6158]" colSpan={2}>{t("discount")}</td><td className="py-1 text-right">-{money(totals.discount)}</td></tr>}
                {totals.credit > 0 && <tr><td className="py-1 text-[#6b6158]" colSpan={2}>{t("referralCredit")}</td><td className="py-1 text-right">-{money(totals.credit)}</td></tr>}
                <tr><td className="py-1 text-[#6b6158]" colSpan={2}>{t("gst")} {data.gstRate}%{data.gstInclusive ? ` (${t("included")})` : ""}</td><td className="py-1 text-right">{money(totals.gst)}</td></tr>
                <tr className="border-t-2 border-brand"><td className="py-2 font-heading text-[15px] font-semibold" colSpan={2}>{t("grandTotal")}</td><td className="py-2 text-right font-heading text-xl font-bold">{money(totals.grand)}</td></tr>
                {data.paid !== undefined && (
                  <>
                    <tr><td className="py-1 text-[#6b6158]" colSpan={2}>{t("received")}</td><td className="py-1 text-right">{money(data.paid)}</td></tr>
                    <tr><td className="py-1 font-medium" colSpan={2}>{t("balanceDue")}</td><td className="py-1 text-right font-semibold">{money(Math.max(0, totals.grand - data.paid))}</td></tr>
                  </>
                )}
              </tfoot>
            )}
          </table>
        </section>
      )}

      <footer className="break-inside-avoid space-y-4 px-8 pb-6 pt-6 text-xs text-[#6b6158]">
        {showPrices && tenant.terms && (
          <div>
            <p className="font-medium text-[#1f1a17]">{t("terms")}</p>
            <p className="mt-1 whitespace-pre-line">{tenant.terms}</p>
          </div>
        )}
        {showPrices && variant !== "quotation" && <DocPayBlock lang={data.lang} due={data.paid !== undefined ? Math.max(0, totals.grand - data.paid) : totals.grand} note={data.number} signed={false} />}
        {showPrices && (
          <div className="grid grid-cols-2 gap-10 pt-8">
            <div className="border-t pt-1">{t("clientSignature")}</div>
            <div className="border-t pt-1 text-right">{t("for")} {tenant.name} · {t("signatory")}</div>
          </div>
        )}
        <p className="text-center">{[tenant.name, tenant.address, tenant.phone, tenant.email].filter(Boolean).join(" · ")}{tenant.gstin && showPrices ? ` · GSTIN ${tenant.gstin}` : ""}</p>
      </footer>
    </article>
  );
}

/** One event: what it is, when and where, its menu by category, and (with prices) its own price table. */
function EventBlock({ f, showPrices, lang }: { f: EventFunction; showPrices: boolean; lang: "en" | "hi" | "gu" }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const foodTypes = useFoodTypes();
  const t = docT(lang);
  const price = priceFunction(f, items, packages, tenant.slabs);
  const pkg = packages.find((p) => p.id === f.packageId);
  const picked = f.itemIds.map((id) => items.find((i) => i.id === id)).filter((i): i is MenuItem => !!i);
  const charges = (f.charges ?? []).filter((c) => chargeAmount(c));
  const service = foodTypes.find((x) => x.id === f.foodTypeId)?.name;

  return (
    <div className="mt-4 break-inside-avoid rounded-xl border">
      <div className="flex items-start justify-between gap-3 border-b bg-[#faf7f2] px-4 py-2.5">
        <div className="min-w-0">
          {service && <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">{t("foodService")}: {service}</p>}
          <h3 className="font-heading text-[15px] font-semibold">{f.name}{pkg ? <span className="ml-2 text-xs font-medium text-[#6b6158]">{pkg.name} {t("package")}</span> : null}</h3>
          <p className="tnum mt-0.5 flex flex-wrap gap-x-4 text-[11px] text-[#6b6158]">
            <span className="inline-flex items-center gap-1"><Clock className="size-3" strokeWidth={2} />{f.session ? `${t(f.session)} · ` : ""}{fmtTime(f.time)}{f.endTime ? ` ${t("to")} ${fmtTime(f.endTime)}` : ""}</span>
            <span className="inline-flex items-center gap-1"><Users className="size-3" strokeWidth={2} />{num(f.pax)} {t("guests")}</span>
            {f.venue && <span className="inline-flex items-center gap-1"><MapPin className="size-3" strokeWidth={2} />{f.venue}</span>}
          </p>
          {pkg?.additions?.some((a) => a.name.trim()) && <p className="mt-0.5 text-[11px] font-medium">+ {pkg.additions.filter((a) => a.name.trim()).map(additionLine).join(" · ")}</p>}
        </div>
        {showPrices && <p className="tnum shrink-0 text-right"><span className="block font-heading text-base font-bold">{money(price.eventTotal)}</span><span className="text-[10px] text-[#6b6158]">{money(price.perPlate)} {t("perPlate")}</span></p>}
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-2 px-4 py-3">
        {roots(categories).map((c) => {
          const inCat = picked.filter((i) => isWithin(i.categoryId, c.id));
          if (!inCat.length) return null;
          return (
            <div key={c.id} className="break-inside-avoid">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6158]">{c.name}</p>
              <ul className="mt-0.5 space-y-0.5">{inCat.map((i) => <li key={i.id} className="flex items-center gap-1.5"><VegMark diet={i.diet} />{dishName(i, lang)}</li>)}</ul>
            </div>
          );
        })}
        {!picked.length && <p className="col-span-3 text-[#6b6158]">{t("menuTbd")}</p>}
      </div>

      {showPrices && (
        <table className="tnum w-full border-t text-[11.5px]">
          <thead><tr className="text-left text-[10px] uppercase tracking-wide text-[#6b6158]"><th className="px-4 py-1.5 font-medium">{t("description")}</th><th className="py-1.5 pr-3 text-right font-medium">{t("qty")}</th><th className="py-1.5 pr-3 text-right font-medium">{t("rate")}</th><th className="px-4 py-1.5 text-right font-medium">{t("amount")}</th></tr></thead>
          <tbody className="divide-y">
            <tr><td className="px-4 py-1">{f.name} {t("food")}</td><td className="py-1 pr-3 text-right">{num(f.pax)}</td><td className="py-1 pr-3 text-right">{money(price.perPlate)}</td><td className="px-4 py-1 text-right">{money(price.perPlate * f.pax)}</td></tr>
            {price.fixed > 0 && <tr><td className="px-4 py-1">{t("counters")}</td><td /><td /><td className="px-4 py-1 text-right">{money(price.fixed)}</td></tr>}
            {charges.map((c) => <tr key={c.id}><td className="px-4 py-1"><span className="inline-flex items-center gap-1">{c.kind === "worker" && <UserRound className="size-3 text-[#6b6158]" strokeWidth={2} />}{c.label}</span></td><td className="py-1 pr-3 text-right">{num(c.qty)}</td><td className="py-1 pr-3 text-right">{rate(c.rate)}</td><td className="px-4 py-1 text-right">{rate(chargeAmount(c))}</td></tr>)}
          </tbody>
          <tfoot><tr className="border-t-2"><td className="px-4 py-1.5 font-medium" colSpan={3}>{f.name} {t("eventTotal")}</td><td className="px-4 py-1.5 text-right font-semibold">{money(price.eventTotal)}</td></tr></tfoot>
        </table>
      )}
    </div>
  );
}
