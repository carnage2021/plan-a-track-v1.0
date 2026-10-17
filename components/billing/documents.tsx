"use client";

import * as React from "react";
import { BrandMark } from "@/components/settings/tenant-forms";
import { modeLabel } from "@/components/sales/payment-sheet";
import { cateringSac, rupeesInWords, type CreditNote, type Invoice } from "@/lib/billing";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { fmtDate, money, num } from "@/lib/utils";

const rupees = (n: number) => money(Math.round(n * 100) / 100);

function DocHeader({ title, number, date }: { title: string; number: string; date: string }) {
  const tenant = useStore((s) => s.tenant);
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 bg-brand px-5 py-5 text-brand-fg md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark className="size-12" />
        <div className="min-w-0">
          <p className="truncate font-heading text-xl font-bold">{tenant.name}</p>
          <p className="text-xs opacity-80">{[tenant.address, tenant.phone].filter(Boolean).join(" · ")}</p>
          {tenant.gstin && <p className="tnum text-xs opacity-80">GSTIN {tenant.gstin}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="font-heading text-base font-semibold">{title}</p>
        <p className="tnum text-xs opacity-80">{number}</p>
        <p className="tnum text-xs opacity-80">{fmtDate(date)}</p>
      </div>
    </header>
  );
}

/** Proforma or GST tax invoice, printed from the frozen copy taken when it was issued. */
export function InvoiceDocument({ invoice, order }: { invoice: Invoice; order: Order }) {
  const tenant = useStore((s) => s.tenant);
  const s = invoice.snapshot;
  const tax = invoice.kind === "tax";
  const half = s.gst / 2;
  return (
    <article className="overflow-hidden rounded-xl border bg-surface text-sm shadow-card print:rounded-none print:border-0 print:shadow-none" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
      <DocHeader title={tax ? "Tax invoice" : "Proforma invoice"} number={invoice.number} date={invoice.issuedOn} />
      <div className="space-y-6 px-5 py-6 md:px-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs text-text-muted">Billed to</p>
            <p className="font-heading text-lg font-semibold">{s.client.name}</p>
            {s.client.address && <p className="text-xs text-text-muted">{s.client.address}</p>}
            <p className="tnum text-xs text-text-muted">{s.client.phone}</p>
            {s.client.gstin && <p className="tnum text-xs">GSTIN {s.client.gstin}</p>}
          </div>
          <dl className="tnum text-right text-xs text-text-muted">
            <div><dt className="inline">Order: </dt><dd className="inline text-text">{order.number}</dd></div>
            <div><dt className="inline">Event: </dt><dd className="inline text-text">{order.eventType}</dd></div>
            {tax && <div><dt className="inline">SAC: </dt><dd className="inline text-text">{cateringSac} (outdoor catering)</dd></div>}
          </dl>
        </div>

        <table className="tnum w-full text-left">
          <thead className="border-b-2 border-brand text-xs text-text-muted">
            <tr><th className="py-2 font-medium">Description</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Rate</th><th className="py-2 text-right font-medium">Amount</th></tr>
          </thead>
          <tbody className="divide-y">
            {s.lines.map((l, i) => (
              <tr key={i} className="break-inside-avoid">
                <td className="py-2 pr-3">{l.label}</td>
                <td className="py-2 text-right">{num(l.qty)}</td>
                <td className="py-2 text-right">{money(l.rate)}</td>
                <td className="py-2 text-right">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="tnum ml-auto max-w-xs space-y-1.5">
          <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd>{money(s.subtotal)}</dd></div>
          {s.discount > 0 && <div className="flex justify-between"><dt className="text-text-muted">Less discount</dt><dd>-{money(s.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-text-muted">Taxable value{s.gstInclusive ? " (prices include GST)" : ""}</dt><dd>{rupees(s.taxable)}</dd></div>
          <div className="flex justify-between"><dt className="text-text-muted">CGST {s.gstRate / 2}%</dt><dd>{rupees(half)}</dd></div>
          <div className="flex justify-between"><dt className="text-text-muted">SGST {s.gstRate / 2}%</dt><dd>{rupees(half)}</dd></div>
          <div className="flex items-baseline justify-between border-t-2 border-brand pt-2"><dt className="font-medium">Invoice total</dt><dd className="font-heading text-xl font-bold">{money(s.total)}</dd></div>
          {s.paid > 0 && <div className="flex justify-between"><dt className="text-text-muted">Received to date</dt><dd>-{money(s.paid)}</dd></div>}
          {s.paid > 0 && <div className="flex justify-between font-medium"><dt>Balance payable</dt><dd>{money(Math.max(0, s.total - s.paid))}</dd></div>}
        </dl>
        <p className="text-xs"><span className="text-text-muted">Amount in words: </span>{rupeesInWords(s.total)}</p>

        <footer className="grid gap-4 border-t pt-4 text-xs text-text-muted sm:grid-cols-2">
          <div>
            {tenant.bankAccount && <p className="tnum">Bank: {tenant.bankName} · A/c {tenant.bankAccount} · IFSC {tenant.ifsc}</p>}
            {tenant.upiId && <p className="tnum">UPI: {tenant.upiId}</p>}
            {!tax && <p className="mt-1">This is a proforma for payment and is not a tax invoice.</p>}
          </div>
          <div className="text-right">
            <p className="mt-8 border-t border-dashed pt-1">For {tenant.name}</p>
            <p>Authorised signatory</p>
          </div>
        </footer>
      </div>
    </article>
  );
}

export function CreditNoteDocument({ note, order }: { note: CreditNote; order: Order }) {
  const tenant = useStore((s) => s.tenant);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  return (
    <article className="overflow-hidden rounded-xl border bg-surface text-sm shadow-card print:rounded-none print:border-0 print:shadow-none" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
      <DocHeader title={note.refundAmount ? "Credit note and refund receipt" : "Credit note"} number={note.number} date={note.issuedOn} />
      <div className="space-y-5 px-5 py-6 md:px-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div><p className="text-xs text-text-muted">Issued to</p><p className="font-heading text-lg font-semibold">{client?.name}</p></div>
          <p className="tnum text-right text-xs text-text-muted">Against order {order.number}<br />{order.eventType}</p>
        </div>
        <p><span className="text-text-muted">Reason: </span>{note.reason}</p>
        <dl className="tnum max-w-sm space-y-1.5">
          <div className="flex items-baseline justify-between border-b-2 border-brand pb-2"><dt className="font-medium">Amount credited</dt><dd className="font-heading text-xl font-bold">{money(note.amount)}</dd></div>
          {note.refundAmount > 0 && <div className="flex justify-between"><dt className="text-text-muted">Refunded{note.refundMode ? ` by ${modeLabel(note.refundMode)}` : ""}</dt><dd>{money(note.refundAmount)}</dd></div>}
          {note.amount > note.refundAmount && <div className="flex justify-between"><dt className="text-text-muted">Adjusted against the bill</dt><dd>{money(note.amount - note.refundAmount)}</dd></div>}
        </dl>
        <p className="text-xs"><span className="text-text-muted">Amount in words: </span>{rupeesInWords(note.amount)}</p>
        <p className="pt-6 text-right text-xs text-text-muted"><span className="inline-block border-t border-dashed pt-1">For {tenant.name}, authorised signatory</span></p>
      </div>
    </article>
  );
}
