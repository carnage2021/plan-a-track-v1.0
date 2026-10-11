"use client";

import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import * as React from "react";
import { BrandMark } from "@/components/settings/tenant-forms";
import { VegMark } from "@/components/shared/badges";
import { priceFunction, priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Discount, EventFunction, ExtraCharge, MenuItem } from "@/lib/types";
import { fmtDate, fmtTime, money, num } from "@/lib/utils";

export interface DocumentData {
  number?: string;
  version?: number;
  clientName: string;
  clientPhone?: string;
  eventType: string;
  functions: EventFunction[];
  extras: ExtraCharge[];
  discount: Discount;
  gstRate: number;
  gstInclusive: boolean;
  date?: string;
  validUntil?: string;
  paid?: number;
}

const titles = { quotation: "Quotation", menu: "Menu card", confirmation: "Booking confirmation" };

/**
 * The branded document the client receives. Rendered as HTML for preview and browser print;
 * the server-side PDF version (React PDF) is part of phase 5 and will reuse this layout.
 */
export function QuoteDocument({ data, variant = "quotation" }: { data: DocumentData; variant?: keyof typeof titles }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const totals = priceQuote(data, items, packages, tenant.slabs);
  const showPrices = variant !== "menu";

  return (
    <article className="overflow-hidden rounded-xl border bg-surface text-sm shadow-card print:rounded-none print:border-0 print:shadow-none" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
      <header className="flex flex-wrap items-center justify-between gap-4 bg-brand px-5 py-5 text-brand-fg md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="size-12" />
          <div className="min-w-0">
            <p className="truncate font-heading text-xl font-bold">{tenant.name}</p>
            <p className="truncate text-xs opacity-80">{tenant.tagline}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-base font-semibold">{titles[variant]}</p>
          {data.number && <p className="tnum text-xs opacity-80">{data.number}{data.version && data.version > 1 ? ` · v${data.version}` : ""}</p>}
        </div>
      </header>

      <div className="space-y-6 px-5 py-6 md:px-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs text-text-muted">Prepared for</p>
            <p className="font-heading text-lg font-semibold">{data.clientName || "Client name"}</p>
            <p className="tnum text-xs text-text-muted">{data.clientPhone}</p>
          </div>
          <dl className="tnum text-right text-xs text-text-muted">
            <div><dt className="inline">Event: </dt><dd className="inline text-text">{data.eventType}</dd></div>
            {data.date && <div><dt className="inline">Date: </dt><dd className="inline text-text">{fmtDate(data.date)}</dd></div>}
            {data.validUntil && variant === "quotation" && <div><dt className="inline">Valid until: </dt><dd className="inline text-text">{fmtDate(data.validUntil)}</dd></div>}
          </dl>
        </div>

        {data.functions.map((f) => {
          const price = priceFunction(f, items, packages, tenant.slabs);
          const pkg = packages.find((p) => p.id === f.packageId);
          const picked = f.itemIds.map((id) => items.find((i) => i.id === id)).filter((i): i is MenuItem => !!i);
          return (
            <section key={f.id} className="break-inside-avoid">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-brand pb-2">
                <div>
                  <h3 className="font-heading text-lg font-semibold">{f.name}{pkg ? <span className="ml-2 text-sm font-medium text-text-muted">{pkg.name} package</span> : null}</h3>
                  <p className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                    {f.date && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" strokeWidth={1.75} />{fmtDate(f.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>}
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" strokeWidth={1.75} />{fmtTime(f.time)}</span>
                    <span className="inline-flex items-center gap-1"><Users className="size-3.5" strokeWidth={1.75} />{num(f.pax)} guests</span>
                    {f.venue && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" strokeWidth={1.75} />{f.venue}</span>}
                  </p>
                </div>
                {showPrices && <p className="tnum text-right"><span className="font-heading text-lg font-bold">{money(price.perPlate)}</span><span className="text-xs text-text-muted"> per plate</span></p>}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
                {categories.map((c) => {
                  const inCat = picked.filter((i) => i.categoryId === c.id);
                  if (inCat.length === 0) return null;
                  return (
                    <div key={c.id} className="break-inside-avoid">
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{c.name}</p>
                      <ul className="mt-1 space-y-1">
                        {inCat.map((i) => <li key={i.id} className="flex items-center gap-2"><VegMark diet={i.diet} />{i.name}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
              {picked.length === 0 && <p className="mt-3 text-text-muted">Menu to be finalised.</p>}
            </section>
          );
        })}

        {showPrices && (
          <section className="break-inside-avoid">
            <table className="tnum w-full">
              <thead>
                <tr className="border-b text-left text-xs text-text-muted"><th className="py-2 font-medium">Description</th><th className="py-2 text-right font-medium">Guests</th><th className="py-2 text-right font-medium">Rate</th><th className="py-2 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.functions.map((f) => {
                  const price = priceFunction(f, items, packages, tenant.slabs);
                  return (
                    <React.Fragment key={f.id}>
                      <tr><td className="py-2">{f.name} food</td><td className="py-2 text-right">{num(f.pax)}</td><td className="py-2 text-right">{money(price.perPlate)}</td><td className="py-2 text-right">{money(price.perPlate * f.pax)}</td></tr>
                      {price.fixed > 0 && <tr><td className="py-2">{f.name} live counters</td><td /><td /><td className="py-2 text-right">{money(price.fixed)}</td></tr>}
                    </React.Fragment>
                  );
                })}
                {data.extras.filter((e) => e.amount).map((e) => <tr key={e.id}><td className="py-2" colSpan={3}>{e.label}</td><td className="py-2 text-right">{money(e.amount)}</td></tr>)}
              </tbody>
              <tfoot>
                <tr className="border-t"><td className="pt-3 text-text-muted" colSpan={3}>Subtotal</td><td className="pt-3 text-right">{money(totals.subtotal)}</td></tr>
                {totals.discount > 0 && <tr><td className="py-1 text-text-muted" colSpan={3}>Discount</td><td className="py-1 text-right">-{money(totals.discount)}</td></tr>}
                <tr><td className="py-1 text-text-muted" colSpan={3}>GST {data.gstRate}%{data.gstInclusive ? " (included above)" : ""}</td><td className="py-1 text-right">{money(totals.gst)}</td></tr>
                <tr className="border-t-2 border-brand"><td className="py-3 font-heading text-base font-semibold" colSpan={3}>Grand total</td><td className="py-3 text-right font-heading text-xl font-bold">{money(totals.grand)}</td></tr>
                {data.paid !== undefined && (
                  <>
                    <tr><td className="py-1 text-text-muted" colSpan={3}>Received</td><td className="py-1 text-right">{money(data.paid)}</td></tr>
                    <tr><td className="py-1 font-medium" colSpan={3}>Balance due</td><td className="py-1 text-right font-semibold">{money(Math.max(0, totals.grand - data.paid))}</td></tr>
                  </>
                )}
              </tfoot>
            </table>
          </section>
        )}

        <footer className="grid gap-4 border-t pt-4 text-xs text-text-muted sm:grid-cols-2">
          {showPrices && (
            <div>
              <p className="font-medium text-text">Terms</p>
              <p className="mt-1">{tenant.terms}</p>
            </div>
          )}
          <div className={showPrices ? "sm:text-right" : ""}>
            <p className="font-medium text-text">{tenant.name}</p>
            <p>{tenant.address}</p>
            <p className="tnum">{tenant.phone} · {tenant.email}</p>
            {tenant.gstin && showPrices && <p className="tnum">GSTIN {tenant.gstin} · UPI {tenant.upiId}</p>}
          </div>
        </footer>
      </div>
    </article>
  );
}

export function quoteShareText(tenantName: string, d: DocumentData, grand: number) {
  const lines = d.functions.map((f) => `• ${f.name}: ${fmtDate(f.date, { day: "numeric", month: "short" })}, ${num(f.pax)} guests, ${f.itemIds.length} dishes`);
  return `Namaste ${d.clientName},\n\nHere is your ${d.eventType.toLowerCase()} quotation ${d.number ?? ""} from ${tenantName}.\n\n${lines.join("\n")}\n\nTotal: ${money(grand)} (GST ${d.gstInclusive ? "included" : "extra as shown"})${d.validUntil ? `\nValid until ${fmtDate(d.validUntil)}` : ""}\n\nReply here to confirm or to ask for changes.`;
}
