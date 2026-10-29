"use client";

import * as React from "react";
import { DocHeader, DocPayBlock, docStyle, useDocs } from "@/components/documents/theme";
import { byDay } from "@/components/sales/event-charges";
import { docT } from "@/lib/doc-i18n";
import { chargeAmount, priceFunction, priceQuote } from "@/lib/pricing";
import { timeRange } from "@/lib/services";
import { useStore } from "@/lib/store";
import { outsourceTotals } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { OutsourceOrder } from "@/lib/supply-types";
import type { EventFunction, Locale, MenuItem, Order } from "@/lib/types";
import { fmtDate, fmtTime, money, num, rate } from "@/lib/utils";

const muted = "text-[#6b6158]";
const label = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6158]";

/**
 * The work order a third-party agency receives for their part of one event: what to make, how many, by when and
 * where, at the agreed rate. It names the caterer and the event, never the client or the client's prices.
 */
export function WorkOrderDoc({ o, order }: { o: OutsourceOrder; order: Order }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const vendor = useSupply((s) => s.vendors.find((v) => v.id === o.vendorId));
  const docs = useDocs();
  const fn = order.functions.find((f) => f.id === o.functionId);
  const totals = outsourceTotals(o);
  const item = (id: string) => items.find((i) => i.id === id);
  const unit = (i?: MenuItem) => (i?.pricingType !== "plate" ? "counter" : i.unit === "plate" ? "plates" : i.unit === "piece" ? "pcs" : i.unit);

  return (
    <article className="bg-white text-[12.5px] leading-relaxed text-[#1f1a17]" style={docStyle(tenant.brandColor, docs.theme)}>
      <DocHeader title="Work order" lines={[o.number, `Date: ${fmtDate(new Date().toISOString().slice(0, 10))}`, order.number]} contact />
      <section className="grid grid-cols-2 gap-6 border-b px-8 py-4">
        <div>
          <p className={label}>To</p>
          <p className="font-heading text-base font-semibold">{vendor?.name}</p>
          {vendor?.phone && <p className={`tnum ${muted}`}>{vendor.phone}</p>}
          {vendor?.gstin && <p className={`tnum ${muted}`}>GSTIN {vendor.gstin}</p>}
        </div>
        <div>
          <p className={label}>Deliver</p>
          <p className="font-medium">{fmtDate(o.deliverOn, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, by {fmtTime(o.deliverTime)}</p>
          <p className={muted}>{o.deliverPlace}</p>
          {o.contact && <p className={`tnum ${muted}`}>Contact on site: {o.contact}</p>}
        </div>
      </section>
      {fn && (
        <section className="border-b px-8 py-3">
          <p className={label}>For the event</p>
          <p className="tnum"><span className="font-medium">{fn.name}</span><span className={muted}> · {fmtDate(fn.date, { weekday: "short", day: "numeric", month: "short" })} · {timeRange(fn)} · {num(fn.pax)} guests</span></p>
        </section>
      )}
      <section className="px-8 py-4">
        <table className="tnum w-full">
          <thead><tr className={`border-b text-left text-[10px] uppercase tracking-wide ${muted}`}><th className="py-1.5 font-medium">#</th><th className="py-1.5 font-medium">Item</th><th className="py-1.5 text-right font-medium">Quantity</th><th className="py-1.5 text-right font-medium">Rate</th><th className="py-1.5 text-right font-medium">Amount</th></tr></thead>
          <tbody className="divide-y">
            {o.lines.map((l, i) => (
              <tr key={l.id}><td className="py-2 pr-2">{i + 1}</td><td className="py-2 font-medium">{item(l.itemId)?.name}</td><td className="py-2 text-right">{num(l.qty)} {unit(item(l.itemId))}</td><td className="py-2 text-right">{rate(l.agencyRate)}</td><td className="py-2 text-right">{rate(l.qty * l.agencyRate)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-brand"><td className="py-2 font-heading text-[15px] font-semibold" colSpan={4}>Total</td><td className="py-2 text-right font-heading text-lg font-bold">{money(totals.cost)}</td></tr></tfoot>
        </table>
        {o.notes && o.notes !== fn?.name && <p className="mt-3 rounded-lg bg-[#faf7f2] p-3"><span className="font-medium">Notes: </span>{o.notes}</p>}
        <ul className={`mt-4 list-disc space-y-1 pl-5 text-xs ${muted}`}>
          <li>Deliver fresh, packed and labelled with the work order number {o.number}.</li>
          <li>Please confirm on WhatsApp when you accept, and again when it leaves for the venue.</li>
          {vendor?.terms && <li>Payment terms: {vendor.terms}</li>}
        </ul>
      </section>
      <footer className="grid grid-cols-2 gap-10 px-8 pb-8 pt-10 text-xs text-[#6b6158]">
        <div className="border-t pt-1">Received and accepted by {vendor?.name}</div>
        <div className="border-t pt-1 text-right">For {tenant.name} · Authorised signatory</div>
      </footer>
    </article>
  );
}

/**
 * Plain bills for the client, without an invoice number (the GST tax invoice stays on the Payments tab).
 * The summary bill prices each event per plate; the itemised bill lists every dish with its own price. Both add the
 * staff, cutlery and other charges, so they come to the same total as the quotation and the tax invoice.
 */
export function OrderBillDoc({ order, itemised, lang }: { order: Order; itemised: boolean; lang: Locale }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const docs = useDocs();
  const t = docT(lang);
  const totals = priceQuote(order, items, packages, tenant.slabs);
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  const th = `py-1.5 font-medium text-[10px] uppercase tracking-wide ${muted}`;

  return (
    <article className="bg-white text-[12.5px] leading-relaxed text-[#1f1a17]" style={docStyle(tenant.brandColor, docs.theme)}>
      <DocHeader title={itemised ? "Itemised bill" : "Bill"} lines={[order.number, `${t("date")}: ${fmtDate(new Date().toISOString().slice(0, 10))}`]} contact />
      <section className="grid grid-cols-2 gap-6 border-b px-8 py-4">
        <div>
          <p className={label}>{t("billedTo")}</p>
          <p className="font-heading text-base font-semibold">{client?.name}</p>
          <p className={`tnum ${muted}`}>{[client?.phone, client?.address].filter(Boolean).join(" · ")}</p>
          {client?.gstin && <p className={`tnum ${muted}`}>GSTIN {client.gstin}</p>}
        </div>
        <div>
          <p className={label}>{t("event")}</p>
          <p className="font-medium">{order.eventType}</p>
          <p className={`tnum ${muted}`}>{order.functions.length} {order.functions.length === 1 ? t("eventOne") : t("events")} · {num(totals.pax)} {t("guests")}</p>
        </div>
      </section>

      <section className="px-8 py-4">
        <table className="tnum w-full">
          <thead><tr className="border-b text-left"><th className={th}>{t("description")}</th><th className={`${th} text-right`}>{t("qty")}</th><th className={`${th} text-right`}>{t("rate")}</th><th className={`${th} text-right`}>{t("amount")}</th></tr></thead>
          {byDay(order.functions).map(([date, fns]) => (
            <tbody key={date} className="break-inside-avoid divide-y">
              <tr className="bg-brand/5"><td className="px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand" colSpan={4}>{fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</td></tr>
              {fns.map((f) => <EventLines key={f.id} f={f} itemised={itemised} lang={lang} />)}
            </tbody>
          ))}
          <tbody className="divide-y">
            {order.extras.filter((e) => e.amount).map((e) => <tr key={e.id}><td className="py-1.5" colSpan={3}>{e.label}</td><td className="py-1.5 text-right">{money(e.amount)}</td></tr>)}
          </tbody>
          <tfoot>
            <tr className="border-t-2"><td className={`pt-2 ${muted}`} colSpan={3}>{t("subtotal")}</td><td className="pt-2 text-right">{money(totals.subtotal)}</td></tr>
            {totals.discount > 0 && <tr><td className={`py-1 ${muted}`} colSpan={3}>{t("discount")}</td><td className="py-1 text-right">-{money(totals.discount)}</td></tr>}
            {totals.credit > 0 && <tr><td className={`py-1 ${muted}`} colSpan={3}>{t("referralCredit")}</td><td className="py-1 text-right">-{money(totals.credit)}</td></tr>}
            <tr><td className={`py-1 ${muted}`} colSpan={3}>{t("gst")} {order.gstRate}%{order.gstInclusive ? ` (${t("included")})` : ""}</td><td className="py-1 text-right">{money(totals.gst)}</td></tr>
            <tr className="border-t-2 border-brand"><td className="py-2 font-heading text-[15px] font-semibold" colSpan={3}>{t("grandTotal")}</td><td className="py-2 text-right font-heading text-xl font-bold">{money(totals.grand)}</td></tr>
            <tr><td className={`py-1 ${muted}`} colSpan={3}>{t("received")}</td><td className="py-1 text-right">{money(paid)}</td></tr>
            <tr><td className="py-1 font-medium" colSpan={3}>{t("balanceDue")}</td><td className="py-1 text-right font-semibold">{money(Math.max(0, totals.grand - paid))}</td></tr>
          </tfoot>
        </table>
      </section>
      <footer className="space-y-4 px-8 pb-6 text-xs text-[#6b6158]">
        <DocPayBlock lang={lang} due={Math.max(0, totals.grand - paid)} note={order.number} />
        <p className="text-center">This bill is not a tax invoice. {[tenant.name, tenant.phone, tenant.email].filter(Boolean).join(" · ")}</p>
      </footer>
    </article>
  );
}

/** One event on a bill: per plate (summary) or dish by dish (itemised), then its counters and charges. */
function EventLines({ f, itemised, lang }: { f: EventFunction; itemised: boolean; lang: Locale }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const t = docT(lang);
  const p = priceFunction(f, items, packages, tenant.slabs);
  const pkg = packages.find((x) => x.id === f.packageId);
  const priceOf = (i: MenuItem) => f.itemPrices?.[i.id] ?? i.price;
  const picked = f.itemIds.map((id) => items.find((i) => i.id === id)).filter((i): i is MenuItem => !!i);
  const plates = picked.filter((i) => i.pricingType === "plate");
  const fixed = picked.filter((i) => i.pricingType !== "plate");
  // The guest-count discount the per-plate price already carries, shown so the itemised lines add up.
  const slab = (p.perPlate - p.basePlate) * f.pax;
  const head = `${f.name} · ${fmtTime(f.time)}${f.endTime ? ` ${t("to")} ${fmtTime(f.endTime)}` : ""}`;
  const row = (key: string, text: React.ReactNode, qty: React.ReactNode, r: React.ReactNode, amount: number | null, cls = "") => (
    <tr key={key} className={cls}><td className="py-1.5 pr-2">{text}</td><td className="py-1.5 text-right">{qty}</td><td className="py-1.5 text-right">{r}</td><td className="py-1.5 text-right">{amount === null ? "" : rate(amount)}</td></tr>
  );

  return (
    <>
      <tr><td className="pt-2.5 font-medium" colSpan={4}>{head} <span className={`text-xs font-normal ${muted}`}>· {num(f.pax)} {t("guests")}{pkg ? ` · ${pkg.name} ${t("package")}` : ""}</span></td></tr>
      {!itemised && row("food", `${t("food")} (${num(f.pax)} × ${money(p.perPlate)} ${t("perPlate")})`, num(f.pax), money(p.perPlate), p.perPlate * f.pax, "")}
      {itemised && pkg && row("pkg", `${pkg.name} ${t("package")}`, num(f.pax), money(pkg.pricePerPlate), pkg.pricePerPlate * f.pax)}
      {itemised && plates.map((i) => {
        const extra = !pkg || p.extraIds.includes(i.id);
        return row(i.id, <span className="pl-3">{i.name}{pkg && !extra ? <span className={`text-xs ${muted}`}> · in package</span> : null}</span>, extra ? num(f.pax) : "", extra ? rate(priceOf(i)) : "", extra ? priceOf(i) * f.pax : null);
      })}
      {itemised && slab !== 0 && row("slab", <span className="pl-3">{p.slabPct}% guest-count discount</span>, "", "", slab)}
      {itemised ? fixed.map((i) => row(i.id, <span className="pl-3">{i.name}</span>, 1, rate(priceOf(i)), priceOf(i))) : p.fixed > 0 && row("fixed", t("counters"), 1, money(p.fixed), p.fixed)}
      {(f.charges ?? []).filter((c) => chargeAmount(c)).map((c) => row(c.id, <span className="pl-3">{c.label}</span>, num(c.qty), rate(c.rate), chargeAmount(c)))}
      <tr className="border-t"><td className="py-1.5 font-medium" colSpan={3}>{f.name} {t("eventTotal")}</td><td className="py-1.5 text-right font-semibold">{money(p.eventTotal)}</td></tr>
    </>
  );
}
