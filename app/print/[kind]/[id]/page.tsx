"use client";

import { useParams, useSearchParams } from "next/navigation";
import * as React from "react";
import { CreditNoteDocument, InvoiceDocument } from "@/components/billing/documents";
import { useOrderMoney } from "@/components/shared/blocks";
import { QuoteDocument } from "@/components/sales/quote-document";
import { useBilling } from "@/lib/billing";
import { useStore } from "@/lib/store";
import type { Locale, Order } from "@/lib/types";

// One document on a blank page, for the PDF route's built-in browser to save. It loads the signed-in
// person's data like any other screen, so a PDF only ever holds what that person may see.

function OrderDoc({ order, variant, lang }: { order: Order; variant: "menu" | "confirmation"; lang: Locale }) {
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const { paid } = useOrderMoney(order);
  return <QuoteDocument variant={variant} data={{ ...order, clientName: client?.name ?? "", clientPhone: client?.phone, date: order.createdAt, paid, lang }} />;
}

function Doc() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const params = useSearchParams();
  const { hydrated, signedIn, quotations, orders, clients } = useStore();
  const billingReady = useBilling((s) => s.ready);
  const invoice = useBilling((s) => s.invoices.find((i) => i.id === id));
  const credit = useBilling((s) => s.credits.find((c) => c.id === id));
  const quote = quotations.find((q) => q.id === id);
  const order = orders.find((o) => o.id === id || o.id === invoice?.orderId || o.id === credit?.orderId);
  const clientLang = clients.find((c) => c.id === (quote?.clientId ?? order?.clientId))?.language;
  const lang = ((params.get("lang") as Locale | null) ?? clientLang ?? "en") as Locale;
  const loaded = hydrated && signedIn && (kind === "quote" || kind === "menu" || kind === "confirmation" || billingReady);

  let body: React.ReactNode = null;
  if (loaded) {
    if (kind === "quote" && quote) {
      const client = clients.find((c) => c.id === quote.clientId);
      body = <QuoteDocument data={{ ...quote, clientName: client?.name ?? "", clientPhone: client?.phone, date: quote.createdAt, lang }} />;
    } else if ((kind === "menu" || kind === "confirmation") && order) body = <OrderDoc order={order} variant={kind} lang={lang} />;
    else if (kind === "invoice" && invoice && order) body = <InvoiceDocument invoice={invoice} order={order} lang={lang} />;
    else if (kind === "credit" && credit && order) body = <CreditNoteDocument note={credit} order={order} lang={lang} />;
  }

  const found = body !== null;
  const title = kind === "invoice" ? invoice?.number : kind === "credit" ? credit?.number : kind === "quote" ? quote?.number : order?.number;
  // Tells the PDF route the page is finished: data in, fonts and photos loaded.
  React.useEffect(() => {
    if (hydrated && !signedIn) document.body.dataset.ready = "signedout";
    if (!loaded) return;
    if (title) document.title = title.split("/").join("-");
    let live = true;
    void (async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
      if (live) document.body.dataset.ready = found ? "1" : "missing";
    })();
    return () => {
      live = false;
    };
  }, [loaded, found, hydrated, signedIn, title]);

  if (!loaded) return null;
  if (!body) return <p className="p-8 text-center">This document was not found.</p>;
  return <div className="mx-auto max-w-[210mm] bg-white">{body}</div>;
}

export default function PrintPage() {
  return (
    <React.Suspense fallback={null}>
      <Doc />
    </React.Suspense>
  );
}
