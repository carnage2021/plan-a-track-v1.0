"use client";

import { ArrowLeft, Ban, CalendarDays, CheckCircle2, Clock, FileQuestion, FileText, History, MapPin, Phone, Play, Printer, QrCode, Receipt, Send, Users, ClipboardCheck, Tags, UtensilsCrossed, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ReceiptPreview, modeLabel, receiptText } from "@/components/sales/payment-sheet";
import { TableQr } from "@/components/documents/table-qr";
import { coordinatorOf } from "@/components/sales/enquiry-sheet";
import { EventSheet } from "@/components/sales/event-sheet";
import { NamePlates } from "@/components/sales/name-plates";
import { QuoteDocument } from "@/components/sales/quote-document";
import { Badge, StatusBadge, VegMark } from "@/components/shared/badges";
import { Avatar, DateBlock, EmptyState, PaxInput, ProgressBar, ServiceLabel, useOrderMoney } from "@/components/shared/blocks";
import { DishImage } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Card, CardTitle, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Modal, Sheet } from "@/components/ui/sheet";
import { BillingCard, BillingGate, LedgerTable, ScheduleCard, useLedger } from "@/components/billing/order-billing";
import { OpsGate } from "@/components/ops/common";
import { OrderOps } from "@/components/ops/order-ops";
import { OrderTasks, StaffGate } from "@/components/staff/order-tasks";
import { CutleryTab } from "@/components/supply/challan";
import { SupplyGate } from "@/components/supply/common";
import { AgenciesTab } from "@/components/supply/outsource";
import { Requirement } from "@/components/supply/requirement";
import { priceFunction, priceQuote } from "@/lib/pricing";
import { useBilling } from "@/lib/billing";
import { useSupply } from "@/lib/supply-store";
import { referrerOf, useCurrentUser, useStore } from "@/lib/store";
import { isWithin, roots } from "@/lib/categories";
import type { EventFunction, MenuItem, Order, Payment, Locale } from "@/lib/types";
import { ExtraDishes } from "@/components/sales/summary-extras";
import { printLight, printThermal, useUi } from "@/lib/ui";
import { fmtDate, money, num, whatsappLink } from "@/lib/utils";
import { logWhatsApp } from "@/lib/messages";
import { DocLangPicker, DownloadPdf } from "@/components/documents/doc-actions";

const laterTabs: { id: string; label: string; phase: number }[] = [];

function PaxChange({ order, fn, onClose }: { order: Order; fn: EventFunction; onClose: () => void }) {
  const { items, packages, tenant } = useStore();
  const changePax = useStore((s) => s.changePax);
  const [pax, setPax] = React.useState(fn.pax);
  const impact = React.useMemo(() => {
    const next = { ...order, functions: order.functions.map((f) => (f.id === fn.id ? { ...f, pax } : f)) };
    return priceQuote(next, items, packages, tenant.slabs).grand - priceQuote(order, items, packages, tenant.slabs).grand;
  }, [order, fn.id, pax, items, packages, tenant.slabs]);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Change guests for ${fn.name}`}
      description="The change is logged with your name and the price difference."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={pax === fn.pax || !pax} onClick={() => { changePax(order.id, fn.id, pax, impact); toast.success(`${fn.name} is now ${num(pax)} guests`, { description: `Order total ${impact >= 0 ? "up" : "down"} by ${money(Math.abs(impact))}` }); onClose(); }}>Save change</Button>
        </>
      }
    >
      <PaxInput value={pax} onChange={setPax} />
      <p className="tnum mt-4 flex justify-between rounded-lg bg-surface-muted px-3 py-2 text-sm">
        <span className="text-text-muted">Price impact, including GST</span>
        <span className={impact > 0 ? "font-medium text-success" : impact < 0 ? "font-medium text-danger" : ""}>{impact === 0 ? "No change" : `${impact > 0 ? "+" : "-"}${money(Math.abs(impact))}`}</span>
      </p>
    </Modal>
  );
}

function OrderLedger({ order }: { order: Order }) {
  const rows = useLedger(React.useMemo(() => [order], [order]));
  const ready = useBilling((s) => s.ready);
  if (!ready) return null;
  return (
    <Card>
      <CardTitle>Ledger</CardTitle>
      <LedgerTable rows={rows} />
    </Card>
  );
}

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  if (!order) return <EmptyState icon={FileQuestion} title="Order not found" help="It may have been removed, or the link is old." action={<Button variant="primary" asChild><Link href="/orders">All orders</Link></Button>} />;
  return <OrderView order={order} />;
}

function OrderView({ order }: { order: Order }) {
  const { clients, items, packages, categories, tenant, users, quotations } = useStore();
  const setOrderStatus = useStore((s) => s.setOrderStatus);
  const patchOrder = useStore((s) => s.patchOrder);
  const setOrderItemPrice = useStore((s) => s.setOrderItemPrice);
  const setRawOverrides = useStore((s) => s.setRawOverrides);
  const referralsReady = useStore((s) => s.referralsReady);
  const isOwner = useCurrentUser().role === "owner";
  const openPayment = useUi((s) => s.openPayment);
  const { totals, bill, paid, due, pct } = useOrderMoney(order);
  const client = clients.find((c) => c.id === order.clientId);
  const referrer = referrerOf(clients, order.referralCode, order.clientId);
  const manager = users.find((u) => u.id === order.managerId);
  const coordinator = coordinatorOf(order, users);
  const quote = quotations.find((q) => q.id === order.quotationId);
  const functions = [...order.functions].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const startTab = useSearchParams().get("tab") ?? "overview";
  const agencyCount = useSupply((s) => s.outsourceOrders.filter((o) => o.orderId === order.id && o.status !== "cancelled").length);
  const [paxFn, setPaxFn] = React.useState<EventFunction | null>(null);
  const [cancel, setCancel] = React.useState(false);
  const [cancelNote, setCancelNote] = React.useState("");
  const [receipt, setReceipt] = React.useState<Payment | null>(null);
  const [docView, setDocView] = React.useState<"confirmation" | "menu" | null>(null);
  const clientLang = useStore((s) => s.clients.find((c) => c.id === order.clientId)?.language) ?? "en";
  const [docLang, setDocLang] = React.useState<Locale>(clientLang);
  const [plates, setPlates] = React.useState(false);
  const [eventSheet, setEventSheet] = React.useState(false);
  const [tableQr, setTableQr] = React.useState(false);
  const locked = order.status === "cancelled" || order.status === "completed";
  const doc = { ...order, clientName: client?.name ?? "", clientPhone: client?.phone, date: order.createdAt, paid };

  const move = (status: Order["status"], message: string) => {
    const before = order.status;
    setOrderStatus(order.id, status);
    toast(message, { action: { label: "Undo", onClick: () => setOrderStatus(order.id, before) } });
  };

  const primary =
    order.status === "cancelled" ? null
    : due > 0 && (order.status === "tentative" || order.status === "completed") ? <Button variant="primary" size="lg" onClick={() => openPayment(order.id)}><Wallet strokeWidth={1.75} />{order.payments.length ? "Record payment" : "Record advance"}</Button>
    : order.status === "confirmed" ? <Button variant="primary" size="lg" onClick={() => move("in_progress", "Event marked in progress")}><Play strokeWidth={1.75} />Start event</Button>
    : order.status === "in_progress" ? <Button variant="primary" size="lg" onClick={() => move("completed", "Event marked completed")}><CheckCircle2 strokeWidth={1.75} />Mark completed</Button>
    : null;

  return (
    <>
      <Card className="p-4 md:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to orders" className="-ml-2"><Link href="/orders"><ArrowLeft strokeWidth={1.75} /></Link></Button>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-bold">{client?.name}<StatusBadge status={order.status} /></h1>
            <p className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
              <span>{order.number}</span><span>{order.eventType}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" strokeWidth={1.75} />{fmtDate(functions[0].date, { day: "numeric", month: "short" })}{functions.length > 1 ? ` to ${fmtDate(functions[functions.length - 1].date, { day: "numeric", month: "short" })}` : ""}</span>
              <span className="inline-flex items-center gap-1"><Users className="size-4" strokeWidth={1.75} />{num(totals.pax)} guests in {functions.length} {functions.length === 1 ? "function" : "functions"}</span>
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {primary}
            {primary && due > 0 && order.status !== "tentative" && order.status !== "completed" && <Button size="lg" onClick={() => openPayment(order.id)}><Wallet strokeWidth={1.75} />Record payment</Button>}
            {!locked && <Button size="lg" variant="ghost" onClick={() => setCancel(true)}><Ban strokeWidth={1.75} />Cancel order</Button>}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="tnum mb-1.5 flex justify-between text-xs text-text-muted"><span>{money(paid)} received</span><span>{Math.round(pct)}%</span></div>
            <ProgressBar value={pct} tone={pct >= 100 ? "success" : "warning"} className="h-2" label="Payment received" />
          </div>
          <dl className="tnum flex gap-6 text-sm">
            <div><dt className="text-xs text-text-muted">{bill !== totals.grand ? "Bill after credits" : "Order total"}</dt><dd className="font-heading text-lg font-bold">{money(bill)}</dd></div>
            <div><dt className="text-xs text-text-muted">Balance due</dt><dd className={`font-heading text-lg font-bold ${due > 0 ? "text-warning" : "text-success"}`}>{money(due)}</dd></div>
          </dl>
        </div>
        {order.status === "cancelled" && order.cancelNote && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">Cancelled: {order.cancelNote}</p>}
      </Card>

      <Tabs defaultValue={startTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="agencies">Agencies{agencyCount > 0 && <Badge>{agencyCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="raw">Raw material</TabsTrigger>
          <TabsTrigger value="cutlery">Cutlery</TabsTrigger>
          <TabsTrigger value="staff">Staff and Tasks</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch and event day</TabsTrigger>
          <TabsTrigger value="payments">Payments<Badge>{order.payments.length}</Badge></TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-3">
            {functions.map((f) => {
              const price = priceFunction(f, items, packages, tenant.slabs);
              const pkg = packages.find((p) => p.id === f.packageId);
              return (
                <Card key={f.id} className="flex gap-3 p-3 md:gap-4 md:p-4">
                  <DateBlock iso={f.date} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-heading text-base font-semibold">{f.name}{pkg && <Badge tone={pkg.tier === "premium" ? "gold" : "neutral"} className="ml-2">{pkg.name}</Badge>}</h3>
                      <p className="tnum text-sm"><span className="font-semibold">{money(price.perPlate)}</span> <span className="text-text-muted">per plate</span></p>
                    </div>
                    <p className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1"><Clock className="size-3.5" strokeWidth={1.75} /><ServiceLabel fn={f} /></span>
                      <span className="inline-flex items-center gap-1"><UtensilsCrossed className="size-3.5" strokeWidth={1.75} />{f.itemIds.length} dishes</span>
                      <a className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.venue)}`} target="_blank" rel="noreferrer"><MapPin className="size-3.5 shrink-0" strokeWidth={1.75} /><span className="truncate">{f.venue}</span></a>
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="tnum inline-flex items-center gap-1.5 text-sm font-medium"><Users className="size-4 text-text-muted" strokeWidth={1.75} />{num(f.pax)} guests</span>
                      {!locked && <Button onClick={() => setPaxFn(f)}>Change guests</Button>}
                    </div>
                  </div>
                </Card>
              );
            })}

            <Card>
              <CardTitle>Special instructions</CardTitle>
              <div className="p-4 pt-2 md:px-5">
                <Textarea value={order.instructions} disabled={locked} onChange={(e) => patchOrder(order.id, { instructions: e.target.value })} placeholder="Jain counter, gate entry, parking, client preferences. Printed on the event sheet." />
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="font-heading text-base font-semibold">People</h2>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={client?.name ?? ""} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{client?.name}</p><p className="tnum text-xs text-text-muted">Client · {client?.phone}</p></div>
                <Button variant="ghost" size="icon" asChild aria-label="Call client"><a href={`tel:${client?.phone.replace(/\s/g, "")}`}><Phone strokeWidth={1.75} /></a></Button>
              </div>
              {manager && (
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={manager.name} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{manager.name}</p><p className="text-xs text-text-muted">Event manager</p></div>
                </div>
              )}
              {coordinator && (
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={coordinator.name} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{coordinator.name}</p><p className="tnum truncate text-xs text-text-muted">Coordinator{coordinator.phone ? ` · ${coordinator.phone}` : ""}{coordinator.email ? ` · ${coordinator.email}` : ""}</p></div>
                  {coordinator.phone && <Button variant="ghost" size="icon" asChild aria-label="Call coordinator"><a href={`tel:${coordinator.phone.replace(/\s/g, "")}`}><Phone strokeWidth={1.75} /></a></Button>}
                </div>
              )}
              {(client?.altPhone || client?.email || client?.address) && (
                <p className="tnum mt-3 space-y-0.5 rounded-lg bg-surface-muted p-3 text-xs text-text-muted">
                  {client.altPhone && <span className="block">Alternate number: <a className="text-primary hover:underline" href={`tel:${client.altPhone.replace(/\s/g, "")}`}>{client.altPhone}</a></span>}
                  {client.email && <span className="block">Email: <a className="text-primary hover:underline" href={`mailto:${client.email}`}>{client.email}</a></span>}
                  {client.address && <span className="block">Address: {client.address}</span>}
                </p>
              )}
              {(order.referralCode || (order.creditUsed ?? 0) > 0) && (
                <div className="mt-3 space-y-1 rounded-lg bg-surface-muted p-3 text-xs">
                  {order.referralCode && <p>Referral code <strong className="tnum">{order.referralCode}</strong>{referrer && <> from <Link className="text-primary hover:underline" href={`/clients?id=${referrer.id}`}>{referrer.name}</Link></>}{order.referralRewarded ? " · reward credited" : " · reward credited when the advance comes in"}</p>}
                  {(order.creditUsed ?? 0) > 0 && <p className="tnum">Referral credit used: {money(order.creditUsed!)}</p>}
                </div>
              )}
            </Card>
            <Card className="p-4">
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold"><History className="size-5 text-text-muted" strokeWidth={1.75} />Change log</h2>
              {order.changeLog.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">No changes since the order was created on {fmtDate(order.createdAt)}.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {order.changeLog.map((c) => (
                    <li key={c.id} className="text-sm">
                      <p>{c.text}</p>
                      <p className="tnum text-xs text-text-muted">{c.by} · {fmtDate(c.at, { day: "numeric", month: "short" })} · {c.priceImpact >= 0 ? "+" : "-"}{money(Math.abs(c.priceImpact))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="space-y-4">
          <ExtraDishes
            functions={functions}
            readOnly={locked || !isOwner}
            title={isOwner ? "Extra dishes · prices for this order" : "Extra dishes"}
            onPrice={(fnId, itemId, price) => {
              const next = { ...order, functions: order.functions.map((f) => (f.id === fnId ? { ...f, itemPrices: { ...f.itemPrices, [itemId]: price ?? items.find((i) => i.id === itemId)!.price } } : f)) };
              const impact = priceQuote(next, items, packages, tenant.slabs).grand - priceQuote(order, items, packages, tenant.slabs).grand;
              setOrderItemPrice(order.id, fnId, itemId, price, impact);
              toast.success("Price changed", { description: `Order total ${impact >= 0 ? "up" : "down"} by ${money(Math.abs(impact))}. Logged in the change log.` });
            }}
          />
          {functions.map((f) => (
            <Card key={f.id}>
              <CardTitle action={<span className="tnum text-xs text-text-muted">{f.itemIds.length} dishes · {num(f.pax)} guests</span>}>{f.name}</CardTitle>
              <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 md:px-5 lg:grid-cols-3">
                {roots(categories).map((c) => {
                  const picked = f.itemIds.map((i) => items.find((x) => x.id === i)).filter((i): i is MenuItem => !!i && isWithin(i.categoryId, c.id));
                  if (!picked.length) return null;
                  return (
                    <div key={c.id}>
                      <p className="mb-2 text-xs font-medium text-text-muted">{c.name}</p>
                      <ul className="space-y-2">
                        {picked.map((i) => (
                          <li key={i.id} className="flex items-center gap-2">
                            <DishImage item={i} sizes="48px" className="w-12 shrink-0 rounded-lg" />
                            <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-sm"><VegMark diet={i.diet} /><span className="truncate">{i.name}</span></span>{f.itemNotes?.[i.id] && <span className="block truncate text-xs text-warning">{f.itemNotes[i.id]}</span>}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="agencies"><SupplyGate><AgenciesTab order={order} /></SupplyGate></TabsContent>
        <TabsContent value="raw"><SupplyGate><Requirement functions={order.functions} orderId={order.id} title={`${client?.name ?? ""} · ${order.number}`} overrides={order.rawOverrides} onOverrides={referralsReady && !locked ? (map) => setRawOverrides(order.id, map) : undefined} /></SupplyGate></TabsContent>
        <TabsContent value="cutlery"><SupplyGate><CutleryTab order={order} /></SupplyGate></TabsContent>

        <TabsContent value="staff"><StaffGate><OrderTasks order={order} /></StaffGate></TabsContent>
        <TabsContent value="dispatch"><OpsGate><OrderOps order={order} /></OpsGate></TabsContent>

        {laterTabs.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            <EmptyState icon={UtensilsCrossed} title={`${t.label} arrives in phase ${t.phase}`} help="It will be generated from this order's menu and guest counts, so there is nothing to re-enter." />
          </TabsContent>
        ))}

        <TabsContent value="payments" className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="min-w-0 space-y-4">
          <Card>
            <CardTitle action={due > 0 && !locked ? <Button onClick={() => openPayment(order.id)}><Wallet strokeWidth={1.75} />Record payment</Button> : undefined}>Payments received</CardTitle>
            {order.payments.length === 0 ? (
              <p className="p-5 text-sm text-text-muted">Nothing received yet. Recording the booking advance confirms this order.</p>
            ) : (
              <ul className="mt-2 divide-y">
                {order.payments.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setReceipt(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/60 md:px-5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><Receipt className="size-5" strokeWidth={1.75} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.note || "Payment"}</span><span className="tnum block truncate text-xs text-text-muted">{p.receiptNo} · {fmtDate(p.date)} · {modeLabel(p.mode)}</span></span>
                      <span className="tnum text-sm font-semibold">{money(p.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <OrderLedger order={order} />
          </div>
          <BillingGate>
            <div className="space-y-4">
              <ScheduleCard order={order} locked={locked} />
              <BillingCard order={order} />
            </div>
          </BillingGate>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <ul className="divide-y">
              {quote && <li><Link href={`/quotations/${quote.id}`} className="flex h-14 items-center gap-3 px-4 text-sm hover:bg-surface-muted/60 md:px-5"><FileText className="size-5 text-text-muted" strokeWidth={1.75} /><span className="flex-1">Quotation</span><span className="tnum text-xs text-text-muted">{quote.number}</span></Link></li>}
              <li><button type="button" onClick={() => setDocView("confirmation")} className="flex h-14 w-full items-center gap-3 px-4 text-left text-sm hover:bg-surface-muted/60 md:px-5"><FileText className="size-5 text-text-muted" strokeWidth={1.75} /><span className="flex-1">Booking confirmation</span><span className="tnum text-xs text-text-muted">{order.number}</span></button></li>
              <li><button type="button" onClick={() => setDocView("menu")} className="flex h-14 w-full items-center gap-3 px-4 text-left text-sm hover:bg-surface-muted/60 md:px-5"><UtensilsCrossed className="size-5 text-text-muted" strokeWidth={1.75} /><span className="flex-1">Menu card</span></button></li>
              <li><button type="button" onClick={() => setEventSheet(true)} className="flex h-14 w-full items-center gap-3 px-4 text-left text-sm hover:bg-surface-muted/60 md:px-5"><ClipboardCheck className="size-5 text-text-muted" strokeWidth={1.75} /><span className="flex-1">Event sheet</span><span className="text-xs text-text-muted">For the event manager</span></button></li>
              <li><button type="button" onClick={() => setPlates(true)} className="flex h-14 w-full items-center gap-3 px-4 text-left text-sm hover:bg-surface-muted/60 md:px-5"><Tags className="size-5 text-text-muted" strokeWidth={1.75} /><span className="flex-1">Counter name plates</span><span className="text-xs text-text-muted">English and Gujarati</span></button></li>
              <li><button type="button" onClick={() => setTableQr(true)} className="flex h-14 w-full items-center gap-3 px-4 text-left text-sm hover:bg-surface-muted/60 md:px-5"><QrCode className="size-5 text-text-muted" strokeWidth={1.75} /><span className="flex-1">Table menu QR</span><span className="text-xs text-text-muted">For guests to scan</span></button></li>
              {order.payments.map((p) => <li key={p.id}><button type="button" onClick={() => setReceipt(p)} className="flex h-14 w-full items-center gap-3 px-4 text-left text-sm hover:bg-surface-muted/60 md:px-5"><Receipt className="size-5 text-text-muted" strokeWidth={1.75} /><span className="flex-1">Payment receipt</span><span className="tnum text-xs text-text-muted">{p.receiptNo}</span></button></li>)}
            </ul>
          </Card>
          <p className="mt-3 text-xs text-text-muted">Proforma and tax invoices and credit notes are on the Payments tab.</p>
        </TabsContent>
      </Tabs>

      {paxFn && <PaxChange order={order} fn={paxFn} onClose={() => setPaxFn(null)} />}

      <Modal
        open={cancel}
        onOpenChange={setCancel}
        title="Cancel this order?"
        description={paid > 0 ? `${money(paid)} has been received. After cancelling, give back any refund with a credit note on the Payments tab.` : "No payment has been received yet."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancel(false)}>Keep order</Button>
            <Button variant="danger" disabled={!cancelNote.trim()} onClick={() => { setOrderStatus(order.id, "cancelled", cancelNote.trim()); setCancel(false); toast("Order cancelled"); }}>Cancel order</Button>
          </>
        }
      >
        <Field label="Reason for cancelling"><Textarea value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="Client postponed the wedding" /></Field>
      </Modal>

      <Sheet open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)} title="Payment receipt">
        {receipt && (
          <div className="space-y-4">
            <ReceiptPreview order={order} amount={receipt.amount} mode={receipt.mode} receiptNo={receipt.receiptNo} date={receipt.date} balance={due} />
            <div data-thermal-hide className="flex flex-wrap gap-2">
              <Button variant="primary" size="lg" className="flex-1" asChild><a href={whatsappLink(client?.phone ?? "", receiptText(tenant.name, client?.name ?? "", order, receipt, due))} target="_blank" rel="noreferrer" onClick={logWhatsApp("receipt", client?.name ?? "", client?.phone ?? "", receiptText(tenant.name, client?.name ?? "", order, receipt, due), order.id)}><Send strokeWidth={1.75} />Send on WhatsApp</a></Button>
              <Button size="lg" onClick={printThermal}><Printer strokeWidth={1.75} />Print 80 mm</Button>
              <Button size="lg" variant="ghost" onClick={printLight}><Printer strokeWidth={1.75} />A4</Button>
            </div>
          </div>
        )}
      </Sheet>

      <NamePlates order={order} open={plates} onOpenChange={setPlates} />
      <EventSheet order={order} open={eventSheet} onOpenChange={setEventSheet} />
      <TableQr order={order} open={tableQr} onOpenChange={setTableQr} />

      <Sheet open={!!docView} onOpenChange={(o) => !o && setDocView(null)} title={docView === "menu" ? "Menu card" : "Booking confirmation"} wide footer={<>{docView && <DownloadPdf kind={docView} id={order.id} lang={docLang} />}<Button onClick={printLight}><Printer strokeWidth={1.75} />Print</Button></>}>
        <DocLangPicker className="mb-3" value={docLang} onChange={setDocLang} />
        {docView && <QuoteDocument data={{ ...doc, lang: docLang }} variant={docView} />}
      </Sheet>
    </>
  );
}

export default function OrderPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <OrderDetail />
    </React.Suspense>
  );
}
