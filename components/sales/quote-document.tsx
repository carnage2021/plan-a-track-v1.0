"use client";

import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import * as React from "react";
import { DocHeader, DocPayBlock, docFrame, docStyle, useDocs } from "@/components/documents/theme";
import { VegMark } from "@/components/shared/badges";
import { priceFunction, priceQuote } from "@/lib/pricing";
import { dishName, docT } from "@/lib/doc-i18n";
import { additionLine } from "@/lib/packages";
import { useFoodTypes } from "@/lib/services";
import { useStore } from "@/lib/store";
import { isWithin, roots } from "@/lib/categories";
import type { Discount, EventFunction, ExtraCharge, Locale, MenuItem } from "@/lib/types";
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
  /** Language of the document; the client's own language by default */
  lang?: Locale;
}


/**
 * The branded document the client receives. Rendered as HTML for preview and browser print;
 * the server-side PDF version (React PDF) is part of phase 5 and will reuse this layout.
 */
export function QuoteDocument({ data, variant = "quotation" }: { data: DocumentData; variant?: "quotation" | "menu" | "confirmation" }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const foodTypes = useFoodTypes();
  const totals = priceQuote(data, items, packages, tenant.slabs);
  const showPrices = variant !== "menu";
  const docs = useDocs();
  const lang = data.lang ?? "en";
  const t = docT(lang);

  return (
    <article className={docFrame(docs.theme)} style={docStyle(tenant.brandColor, docs.theme)}>
      <DocHeader title={t(variant)} lines={[data.number ? `${data.number}${data.version && data.version > 1 ? ` · v${data.version}` : ""}` : ""]} />

      <div className="space-y-6 px-5 py-6 md:px-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs text-text-muted">{t("preparedFor")}</p>
            <p className="font-heading text-lg font-semibold">{data.clientName || t("clientName")}</p>
            <p className="tnum text-xs text-text-muted">{data.clientPhone}</p>
          </div>
          <dl className="tnum text-right text-xs text-text-muted">
            <div><dt className="inline">{t("event")}: </dt><dd className="inline text-text">{data.eventType}</dd></div>
            {data.date && <div><dt className="inline">{t("date")}: </dt><dd className="inline text-text">{fmtDate(data.date)}</dd></div>}
            {data.validUntil && variant === "quotation" && <div><dt className="inline">{t("validUntil")}: </dt><dd className="inline text-text">{fmtDate(data.validUntil)}</dd></div>}
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
                  {f.foodTypeId && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">{foodTypes.find((x) => x.id === f.foodTypeId)?.name}</p>}
                  <h3 className="font-heading text-lg font-semibold">{f.name}{pkg ? <span className="ml-2 text-sm font-medium text-text-muted">{pkg.name} {t("package")}</span> : null}</h3>
                  <p className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                    {f.date && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" strokeWidth={1.75} />{fmtDate(f.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>}
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" strokeWidth={1.75} />{f.session ? `${t(f.session)} · ` : ""}{fmtTime(f.time)}{f.endTime ? ` ${t("to")} ${fmtTime(f.endTime)}` : ""}</span>
                    <span className="inline-flex items-center gap-1"><Users className="size-3.5" strokeWidth={1.75} />{num(f.pax)} {t("guests")}</span>
                    {f.venue && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" strokeWidth={1.75} />{f.venue}</span>}
                  </p>
                  {pkg?.additions?.some((a) => a.name.trim()) && <p className="mt-1 text-xs font-medium">+ {pkg.additions.filter((a) => a.name.trim()).map(additionLine).join(" · ")}</p>}
                </div>
                {showPrices && <p className="tnum text-right"><span className="font-heading text-lg font-bold">{money(price.perPlate)}</span><span className="text-xs text-text-muted"> {t("perPlate")}</span></p>}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
                {roots(categories).map((c) => {
                  const inCat = picked.filter((i) => isWithin(i.categoryId, c.id));
                  if (inCat.length === 0) return null;
                  return (
                    <div key={c.id} className="break-inside-avoid">
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{c.name}</p>
                      <ul className="mt-1 space-y-1">
                        {inCat.map((i) => <li key={i.id} className="flex items-center gap-2"><VegMark diet={i.diet} />{dishName(i, lang)}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
              {picked.length === 0 && <p className="mt-3 text-text-muted">{t("menuTbd")}</p>}
            </section>
          );
        })}

        {showPrices && (
          <section className="break-inside-avoid">
            <table className="tnum w-full">
              <thead>
                <tr className="border-b text-left text-xs text-text-muted"><th className="py-2 font-medium">{t("description")}</th><th className="py-2 text-right font-medium">{t("guests")}</th><th className="py-2 text-right font-medium">{t("rate")}</th><th className="py-2 text-right font-medium">{t("amount")}</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.functions.map((f) => {
                  const price = priceFunction(f, items, packages, tenant.slabs);
                  return (
                    <React.Fragment key={f.id}>
                      <tr><td className="py-2">{f.name} {t("food")}</td><td className="py-2 text-right">{num(f.pax)}</td><td className="py-2 text-right">{money(price.perPlate)}</td><td className="py-2 text-right">{money(price.perPlate * f.pax)}</td></tr>
                      {price.fixed > 0 && <tr><td className="py-2">{f.name} {t("liveCounters")}</td><td /><td /><td className="py-2 text-right">{money(price.fixed)}</td></tr>}
                    </React.Fragment>
                  );
                })}
                {data.extras.filter((e) => e.amount).map((e) => <tr key={e.id}><td className="py-2" colSpan={3}>{e.label}</td><td className="py-2 text-right">{money(e.amount)}</td></tr>)}
              </tbody>
              <tfoot>
                <tr className="border-t"><td className="pt-3 text-text-muted" colSpan={3}>{t("subtotal")}</td><td className="pt-3 text-right">{money(totals.subtotal)}</td></tr>
                {totals.discount > 0 && <tr><td className="py-1 text-text-muted" colSpan={3}>{t("discount")}</td><td className="py-1 text-right">-{money(totals.discount)}</td></tr>}
                {totals.credit > 0 && <tr><td className="py-1 text-text-muted" colSpan={3}>{t("referralCredit")}</td><td className="py-1 text-right">-{money(totals.credit)}</td></tr>}
                <tr><td className="py-1 text-text-muted" colSpan={3}>{t("gst")} {data.gstRate}%{data.gstInclusive ? ` (${t("included")})` : ""}</td><td className="py-1 text-right">{money(totals.gst)}</td></tr>
                <tr className="border-t-2 border-brand"><td className="py-3 font-heading text-base font-semibold" colSpan={3}>{t("grandTotal")}</td><td className="py-3 text-right font-heading text-xl font-bold">{money(totals.grand)}</td></tr>
                {data.paid !== undefined && (
                  <>
                    <tr><td className="py-1 text-text-muted" colSpan={3}>{t("received")}</td><td className="py-1 text-right">{money(data.paid)}</td></tr>
                    <tr><td className="py-1 font-medium" colSpan={3}>{t("balanceDue")}</td><td className="py-1 text-right font-semibold">{money(Math.max(0, totals.grand - data.paid))}</td></tr>
                  </>
                )}
              </tfoot>
            </table>
          </section>
        )}

        <footer className="grid gap-4 border-t pt-4 text-xs text-text-muted sm:grid-cols-2">
          {showPrices && (
            <div>
              <p className="font-medium text-text">{t("terms")}</p>
              <p className="mt-1">{tenant.terms}</p>
            </div>
          )}
          <div className={showPrices ? "sm:text-right" : ""}>
            <p className="font-medium text-text">{tenant.name}</p>
            <p>{tenant.address}</p>
            <p className="tnum">{tenant.phone} · {tenant.email}</p>
            {tenant.gstin && showPrices && <p className="tnum">GSTIN {tenant.gstin}</p>}
          </div>
        </footer>
        {showPrices && variant !== "quotation" && <DocPayBlock lang={lang} due={data.paid !== undefined ? Math.max(0, totals.grand - data.paid) : totals.grand} note={data.number} />}
      </div>
    </article>
  );
}

export function quoteShareText(tenantName: string, d: DocumentData, grand: number) {
  const lines = d.functions.map((f) => `• ${f.name}: ${fmtDate(f.date, { day: "numeric", month: "short" })}, ${num(f.pax)} guests, ${f.itemIds.length} dishes`);
  return `Namaste ${d.clientName},\n\nHere is your ${d.eventType.toLowerCase()} quotation ${d.number ?? ""} from ${tenantName}.\n\n${lines.join("\n")}\n\nTotal: ${money(grand)} (GST ${d.gstInclusive ? "included" : "extra as shown"})${d.validUntil ? `\nValid until ${fmtDate(d.validUntil)}` : ""}\n\nReply here to confirm or to ask for changes.`;
}
