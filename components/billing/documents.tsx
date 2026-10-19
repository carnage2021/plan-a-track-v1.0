"use client";

import * as React from "react";
import { DocHeader, DocPayBlock, docFrame, docStyle, useDocs } from "@/components/documents/theme";
import { modeLabel } from "@/components/sales/payment-sheet";
import { cateringSac, rupeesInWords, type CreditNote, type Invoice } from "@/lib/billing";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { fmtDate, money, num } from "@/lib/utils";

const rupees = (n: number) => money(Math.round(n * 100) / 100);

/** Proforma or GST tax invoice, printed from the frozen copy taken when it was issued. */
export function InvoiceDocument({ invoice, order }: { invoice: Invoice; order: Order }) {
  const tenant = useStore((s) => s.tenant);
  const docs = useDocs();
  const s = invoice.snapshot;
  const tax = invoice.kind === "tax";
  const half = s.gst / 2;
  return (
    <article className={docFrame(docs.theme)} style={docStyle(tenant.brandColor, docs.theme)}>
      <DocHeader contact title={tax ? "Tax invoice" : "Proforma invoice"} lines={[invoice.number, fmtDate(invoice.issuedOn)]} />
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

        {!tax && <p className="text-xs text-text-muted">This is a proforma for payment and is not a tax invoice.</p>}
        <DocPayBlock due={Math.max(0, s.total - s.paid)} note={invoice.number} />
      </div>
    </article>
  );
}

export function CreditNoteDocument({ note, order }: { note: CreditNote; order: Order }) {
  const tenant = useStore((s) => s.tenant);
  const docs = useDocs();
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  return (
    <article className={docFrame(docs.theme)} style={docStyle(tenant.brandColor, docs.theme)}>
      <DocHeader contact title={note.refundAmount ? "Credit note and refund receipt" : "Credit note"} lines={[note.number, fmtDate(note.issuedOn)]} />
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
        <DocPayBlock due={0} />
      </div>
    </article>
  );
}
