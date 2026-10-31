"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, FileText, PartyPopper, Plus, Save, Send, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PdfDownloads } from "@/components/documents/doc-actions";
import { MenuSelector } from "@/components/menu/menu-selector";
import { PaymentSheet } from "@/components/sales/payment-sheet";
import { QuoteDocument } from "@/components/sales/quote-document";
import { DetailsForm, SummaryForm, useDraftTotals } from "@/components/sales/quote-forms";
import { BrandMark } from "@/components/settings/tenant-forms";
import { Stepper, useOrderMoney } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { blankDraft, blankFunction, draftIssues, emptyServices, namedServices, useQuoteDraft } from "@/lib/draft";
import { priceFunction } from "@/lib/pricing";
import { useCurrentUser, useStore } from "@/lib/store";
import type { Order, QuoteDraft } from "@/lib/types";
import { useUi } from "@/lib/ui";
import { fmtDate, money, num, uid, whatsappLink } from "@/lib/utils";
import { logWhatsApp } from "@/lib/messages";

const steps = ["Client and event", "Menu", "Extras and total", "Confirm"];

function Booked({ order, onNew }: { order: Order; onNew: () => void }) {
  const tenant = useStore((s) => s.tenant);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const openPayment = useUi((s) => s.openPayment);
  const { totals, paid, due } = useOrderMoney(order);
  const text = `Namaste ${client?.name}, your ${order.eventType.toLowerCase()} booking with ${tenant.name} is ${paid > 0 ? "confirmed" : "reserved"}.\n\n${order.functions.map((f) => `• ${f.name}: ${fmtDate(f.date, { weekday: "short", day: "numeric", month: "short" })}, ${num(f.pax)} guests`).join("\n")}\n\nBooking no. ${order.number}\nTotal: ${money(totals.grand)}\nReceived: ${money(paid)}\nBalance: ${money(due)}\n\nThank you for choosing us.`;
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-success/10 text-success"><PartyPopper className="size-9" strokeWidth={1.5} /></span>
      <h1 className="mt-4 font-heading text-3xl font-bold">{paid > 0 ? "Booking confirmed" : "Booking created"}</h1>
      <p className="tnum mt-2 text-sm text-text-muted">{order.number} · {client?.name} · {money(totals.grand)}</p>
      <Card className="mt-6 p-4 text-left">
        <dl className="tnum grid grid-cols-3 gap-3 text-center text-sm">
          <div><dt className="text-xs text-text-muted">Total</dt><dd className="font-heading text-lg font-bold">{money(totals.grand)}</dd></div>
          <div><dt className="text-xs text-text-muted">Received</dt><dd className="font-heading text-lg font-bold text-success">{money(paid)}</dd></div>
          <div><dt className="text-xs text-text-muted">Balance</dt><dd className="font-heading text-lg font-bold">{money(due)}</dd></div>
        </dl>
        {paid === 0 && <p className="mt-3 rounded-lg bg-warning/10 p-3 text-xs text-warning">The date is held as tentative. Record the advance to confirm it.</p>}
      </Card>
      <Card className="mt-4 p-4 text-left">
        <p className="mb-2 text-sm font-medium">Booking confirmation PDF</p>
        <PdfDownloads kind="confirmation" id={order.id} lang={client?.language ?? "en"} functions={order.functions} />
      </Card>
      <div className="mt-6 flex flex-col gap-2">
        {due > 0 && <Button variant={paid === 0 ? "primary" : "secondary"} size="lg" onClick={() => openPayment(order.id)}><Wallet strokeWidth={1.75} />{paid === 0 ? "Record the advance" : "Record another payment"}</Button>}
        <Button variant={paid > 0 ? "primary" : "secondary"} size="lg" asChild><a href={whatsappLink(client?.phone ?? "", text)} target="_blank" rel="noreferrer" onClick={logWhatsApp("confirmation", client?.name ?? "", client?.phone ?? "", text)}><Send strokeWidth={1.75} />Send confirmation on WhatsApp</a></Button>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" asChild><Link href={`/orders/${order.id}`}><ClipboardList strokeWidth={1.75} />Open order</Link></Button>
          <Button size="lg" onClick={onNew}><Plus strokeWidth={1.75} />New booking</Button>
        </div>
      </div>
    </div>
  );
}

function BookingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const enquiryId = params.get("enquiry") ?? undefined;
  const reviseId = params.get("revise") ?? undefined;
  const user = useCurrentUser();
  const tenant = useStore((s) => s.tenant);
  const createQuotation = useStore((s) => s.createQuotation);
  const convertToOrder = useStore((s) => s.convertToOrder);

  // Opened from an enquiry, its client and services fill in; opened to revise a quotation, that quotation does.
  const fresh = React.useCallback((): QuoteDraft => {
    const s = useStore.getState();
    const quote = s.quotations.find((q) => q.id === reviseId);
    if (quote) {
      const c = s.clients.find((x) => x.id === quote.clientId);
      return { ...blankDraft(), clientId: quote.clientId, clientName: c?.name ?? "", clientPhone: c?.phone ?? "", clientEmail: c?.email ?? "", clientAltPhone: c?.altPhone ?? "", clientAddress: c?.address ?? "", coordinatorId: quote.coordinatorId, coordinator: quote.coordinator, eventType: quote.eventType, functions: quote.functions, extras: quote.extras, discount: quote.discount, reviseOf: quote.id, enquiryId: quote.enquiryId, referralCode: quote.referralCode, creditUsed: quote.creditUsed, step: 1 };
    }
    const enquiry = s.enquiries.find((e) => e.id === enquiryId);
    if (enquiry) {
      const c = s.clients.find((x) => x.id === enquiry.clientId);
      // The services asked for in the enquiry become the booking's events, menus still to pick.
      const functions = enquiry.services?.length ? enquiry.services.map((f) => ({ ...f, id: uid(), itemIds: [] })) : [blankFunction("", enquiry.date, enquiry.pax, enquiry.venue)];
      return { ...blankDraft(), clientId: enquiry.clientId, clientName: c?.name ?? "", clientPhone: c?.phone ?? "", clientEmail: c?.email ?? "", clientAltPhone: c?.altPhone ?? "", clientAddress: c?.address ?? "", coordinatorId: enquiry.coordinatorId, coordinator: enquiry.coordinator, eventType: enquiry.eventType, enquiryId, functions, step: 0 };
    }
    return blankDraft();
  }, [enquiryId, reviseId]);

  const { draft, setDraft, clear, restart, resumed } = useQuoteDraft("booking", fresh, !enquiryId && !reviseId);
  const revising = useStore((s) => s.quotations.find((q) => q.id === draft.reviseOf));
  // The new version comes after the newest in the group, not after the one the revision started from.
  const nextVersion = useStore((s) => (revising ? Math.max(...s.quotations.filter((q) => q.groupId === revising.groupId).map((q) => q.version)) + 1 : 1));
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  // Events built dish by dish with main course dishes but no main course rate typed in yet.
  const noMainRate = draft.functions.filter((f) => { const p = priceFunction(f, items, packages, tenant.slabs); return p.needsMainRate && !p.mainRate; }).map((f) => f.name);
  const [activeFn, setActiveFn] = React.useState(draft.functions[0]?.id ?? "");
  const [showErrors, setShowErrors] = React.useState(false);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  const { totals, needsApproval } = useDraftTotals(draft);
  const issues = draftIssues(draft);
  const blocked = needsApproval && user.role !== "owner";
  const step = draft.step;

  React.useEffect(() => {
    if (resumed) toast("Continuing the saved booking", { action: { label: "Start fresh", onClick: restart } });
    // Shown once when booking mode opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (next: number) => {
    if (next > 2 && step === 2 && noMainRate.length) {
      toast.error(`Enter the main course rate per plate for ${noMainRate.join(", ")}`, { description: "Main course dishes have no price of their own; the rate counts on the bill." });
      return;
    }
    if (next > 0 && issues.length) {
      setShowErrors(true);
      setDraft({ step: 0 });
      toast.error(issues[0], { description: issues.length > 1 ? `and ${issues.length - 1} more to fill in, marked in red` : undefined });
      return;
    }
    // Blank service names take their food type's name, or "Service 7", rather than holding the booking up.
    setDraft((d) => ({ step: next, functions: namedServices(d.functions) }));
    window.scrollTo({ top: 0 });
  };
  const saveLater = () => {
    setDraft({});
    toast.success("Saved as draft", { description: "Open booking mode again to continue from here." });
    router.push("/");
  };
  const [busy, setBusy] = React.useState(false);
  const save = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      toast.error("The booking was not saved", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  /** Stops a save while an event still needs its main course rate, and takes the salesperson back to it. */
  const ratesMissing = () => {
    if (!noMainRate.length) return false;
    toast.error(`Enter the main course rate per plate for ${noMainRate.join(", ")}`);
    setDraft({ step: 2 });
    return true;
  };
  const quoteOnly = () =>
    !ratesMissing() &&
    save(async () => {
      const id = await createQuotation(draft, blocked ? "pending_approval" : "draft");
      clear();
      toast.success(blocked ? "Quotation sent to the owner for approval" : revising ? `Saved as version ${nextVersion}` : "Quotation saved", { description: "Approve it from Orders, Quotations when the client says yes." });
      router.push(`/quotations/${id}`);
    });
  const confirm = () =>
    !ratesMissing() &&
    save(async () => {
      const id = await convertToOrder(await createQuotation(draft, "approved"));
      clear();
      setOrderId(id);
      window.scrollTo({ top: 0 });
    });
  const startNew = () => {
    setOrderId(null);
    restart();
  };

  const doc = { clientName: draft.clientName, clientPhone: draft.clientPhone, eventType: draft.eventType, functions: draft.functions, extras: draft.extras, discount: draft.discount, gstRate: tenant.gstRate, gstInclusive: tenant.gstInclusive, number: revising?.number, version: revising ? nextVersion : undefined };

  return (
    <div className="min-h-dvh" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
      <header className="sticky top-0 z-30">
        <div className="flex h-14 items-center gap-3 bg-brand px-4 text-brand-fg md:px-6">
          <BrandMark className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-base font-semibold">{tenant.name}</p>
            <p className="truncate text-xs opacity-80">{revising ? `Revising ${revising.number}, saves as version ${nextVersion}` : draft.clientName ? `${draft.clientName} · ${draft.eventType}` : tenant.tagline}</p>
          </div>
          {!order && <p className="tnum text-right max-sm:hidden"><span className="block text-xs opacity-80">Total so far</span><span className="font-heading text-base font-semibold">{money(totals.grand)}</span></p>}
          <Link href="/" aria-label="Exit booking mode" title="Exit booking mode" className="grid size-9 place-items-center rounded-lg hover:bg-brand-fg/15"><X className="size-5" strokeWidth={1.75} /></Link>
        </div>
        {!order && <div className="border-b bg-surface px-4 py-2 md:px-6"><Stepper steps={steps} current={step} onStep={go} /></div>}
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-4 md:px-6 md:pt-6">
        {order ? (
          <Booked order={order} onNew={startNew} />
        ) : (
          <>
            {step === 0 && (
              <div className="mx-auto max-w-4xl">
                <h1 className="mb-4 font-heading text-2xl font-bold md:text-3xl">Let us plan your event</h1>
                <DetailsForm draft={draft} setDraft={setDraft} showErrors={showErrors} />
                <div className="mt-6 flex justify-end"><Button variant="primary" size="lg" onClick={() => go(1)}>Choose the menu<ArrowRight strokeWidth={1.75} /></Button></div>
              </div>
            )}

            {step === 1 && (
              <MenuSelector
                booking
                top={124}
                functions={draft.functions}
                onChange={(functions) => setDraft({ functions })}
                activeId={activeFn}
                onActive={setActiveFn}
                extras={draft.extras}
                discount={draft.discount}
                clientId={draft.clientId}
                actions={
                  <>
                    <Button variant="primary" size="lg" onClick={() => go(2)}>Extras and total<ArrowRight strokeWidth={1.75} /></Button>
                    <Button onClick={saveLater}><Save strokeWidth={1.75} />Decide later, save draft</Button>
                  </>
                }
              />
            )}

            {step === 2 && (
              <div className="mx-auto max-w-5xl">
                <h1 className="mb-4 font-heading text-2xl font-bold md:text-3xl">Extras and total</h1>
                <SummaryForm draft={draft} setDraft={setDraft} hideMargin />
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button size="lg" variant="ghost" onClick={() => go(1)}><ArrowLeft strokeWidth={1.75} />Back to menu</Button>
                  <Button variant="primary" size="lg" onClick={() => go(3)}>Review booking<ArrowRight strokeWidth={1.75} /></Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
                <QuoteDocument data={doc} />
                <Card className="space-y-3 p-4 lg:sticky lg:top-32">
                  <h2 className="font-heading text-lg font-semibold">Ready to book?</h2>
                  <p className="tnum text-sm text-text-muted">{draft.functions.length} {draft.functions.length === 1 ? "function" : "functions"} · {num(totals.pax)} guests</p>
                  <p className="tnum font-heading text-3xl font-bold">{money(totals.grand)}</p>
                  {emptyServices(draft.functions).length > 0 && <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">No menu yet for {emptyServices(draft.functions).join(", ")}. You can book now and add it later from the order, or go back to the menu.</p>}
                  {blocked ? (
                    <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">The discount is above {tenant.discountApprovalPct}%, so the owner has to approve it before this can be booked.</p>
                  ) : (
                    <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={confirm}><CheckCircle2 strokeWidth={1.75} />Confirm booking</Button>
                  )}
                  <Button size="lg" className="w-full" disabled={busy} onClick={quoteOnly}><FileText strokeWidth={1.75} />{blocked ? "Send for approval" : revising ? `Save as quotation v${nextVersion}` : "Save as quotation"}</Button>
                  <Button size="lg" variant="ghost" className="w-full" onClick={saveLater}><Save strokeWidth={1.75} />Decide later, save draft</Button>
                  <p className="text-xs text-text-muted">Confirm books it now, and you can take the advance by cash, UPI or bank. Save as quotation keeps it in Orders, Quotations until the client approves.</p>
                </Card>
              </div>
            )}
          </>
        )}
      </main>
      <PaymentSheet />
    </div>
  );
}

/** Assisted booking mode (B5): full screen, used by the salesperson with the client sitting beside them. */
export default function BookingPage() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const signedIn = useStore((s) => s.signedIn);
  React.useEffect(() => {
    if (hydrated && !signedIn) router.replace("/login");
  }, [hydrated, signedIn, router]);
  const loading = <div className="p-6"><Skeleton className="h-14 rounded-xl" /><Skeleton className="mt-6 h-96 rounded-xl" /></div>;
  if (!hydrated || !signedIn) return loading;
  return <React.Suspense fallback={loading}><BookingFlow /></React.Suspense>;
}
