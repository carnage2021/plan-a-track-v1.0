"use client";

import { useParams, useSearchParams } from "next/navigation";
import * as React from "react";
import { CreditNoteDocument, InvoiceDocument } from "@/components/billing/documents";
import { useOrderMoney } from "@/components/shared/blocks";
import { EventPdf } from "@/components/documents/event-pdf";
import { OrderBillDoc, WorkOrderDoc } from "@/components/documents/order-docs";
import { useSupply } from "@/lib/supply-store";
import { coordinatorOf } from "@/components/sales/enquiry-sheet";
import { useBilling } from "@/lib/billing";
import { useStore } from "@/lib/store";
import type { Locale, Order } from "@/lib/types";

// One document on a blank page, for the PDF route's built-in browser to save. It loads the signed-in
// person's data like any other screen, so a PDF only ever holds what that person may see.

function OrderDoc({ order, variant, lang, day }: { order: Order; variant: "menu" | "confirmation"; lang: Locale; day?: string }) {
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const users = useStore((s) => s.users);
  const { paid } = useOrderMoney(order);
  return <EventPdf variant={variant} day={day} coordinator={coordinatorOf(order, users)} data={{ ...order, clientName: client?.name ?? "", clientPhone: client?.phone, date: order.createdAt, paid, lang }} />;
}

function Doc() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const params = useSearchParams();
  const { hydrated, signedIn, quotations, orders, clients, users, tenant } = useStore();
  // A day's document holds only that day's events.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get("day") ?? "") ? params.get("day")! : undefined;
  const billingReady = useBilling((s) => s.ready);
  const supplyReady = useSupply((s) => s.ready);
  const work = useSupply((s) => s.outsourceOrders.find((o) => o.id === id));
  const invoice = useBilling((s) => s.invoices.find((i) => i.id === id));
  const credit = useBilling((s) => s.credits.find((c) => c.id === id));
  const quote = quotations.find((q) => q.id === id);
  const order = orders.find((o) => o.id === id || o.id === invoice?.orderId || o.id === credit?.orderId || o.id === work?.orderId);
  const clientLang = clients.find((c) => c.id === (quote?.clientId ?? order?.clientId))?.language;
  const lang = ((params.get("lang") as Locale | null) ?? clientLang ?? "en") as Locale;
  const loaded = hydrated && signedIn && (["quote", "menu", "confirmation", "bill", "itemised"].includes(kind) || (kind === "workorder" ? supplyReady : billingReady));

  let body: React.ReactNode = null;
  if (loaded) {
    if (kind === "quote" && quote) {
      const client = clients.find((c) => c.id === quote.clientId);
      body = <EventPdf variant="quotation" day={day} coordinator={coordinatorOf(quote, users)} data={{ ...quote, clientName: client?.name ?? "", clientPhone: client?.phone, date: quote.createdAt, lang }} />;
    } else if ((kind === "menu" || kind === "confirmation") && order) body = <OrderDoc order={order} variant={kind} lang={lang} day={day} />;
    else if ((kind === "bill" || kind === "itemised") && order) body = <OrderBillDoc order={order} itemised={kind === "itemised"} lang={lang} />;
    else if (kind === "workorder" && work && order) body = <WorkOrderDoc o={work} order={order} />;
    else if (kind === "invoice" && invoice && order) body = <InvoiceDocument invoice={invoice} order={order} lang={lang} />;
    else if (kind === "credit" && credit && order) body = <CreditNoteDocument note={credit} order={order} lang={lang} />;
  }

  const found = body !== null;
  const title = kind === "invoice" ? invoice?.number : kind === "credit" ? credit?.number : kind === "quote" ? quote?.number : kind === "workorder" ? work?.number : kind === "bill" || kind === "itemised" ? `${order?.number ?? ""} ${kind === "bill" ? "Bill" : "Itemised bill"}` : order?.number;
  // Tells the PDF route the page is finished: data in, fonts and photos loaded.
  React.useEffect(() => {
    if (hydrated && !signedIn) document.body.dataset.ready = "signedout";
    if (!loaded) return;
    if (title) document.title = title.split("/").join("-") + (day ? `-${day}` : "");
    // The PDF route prints this on every page, with the page number.
    document.body.dataset.footer = [tenant.name, title].filter(Boolean).join(" · ");
    let live = true;
    void (async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
      if (live) document.body.dataset.ready = found ? "1" : "missing";
    })();
    return () => {
      live = false;
    };
  }, [loaded, found, hydrated, signedIn, title, day, tenant.name]);

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
