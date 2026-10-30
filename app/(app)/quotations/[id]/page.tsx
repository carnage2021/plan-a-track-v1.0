"use client";

import { ArrowLeft, ArrowRight, ClipboardCheck, FileQuestion, MessageCircleReply, PencilLine, Printer, Send, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { QuoteDocument, quoteShareText } from "@/components/sales/quote-document";
import { Badge, StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Skeleton } from "@/components/ui/primitives";
import { priceQuote } from "@/lib/pricing";
import { useCurrentUser, useStore } from "@/lib/store";
import type { QuoteStatus, Quotation } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { cn, daysFromToday, fmtDate, money, whatsappLink } from "@/lib/utils";
import { logWhatsApp } from "@/lib/messages";
import { DocLangPicker, PdfDownloads } from "@/components/documents/doc-actions";
import type { Locale } from "@/lib/types";

function QuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useCurrentUser();
  const { quotations, clients, orders, items, packages, tenant } = useStore();
  const setQuoteStatus = useStore((s) => s.setQuoteStatus);
  const convertToOrder = useStore((s) => s.convertToOrder);
  const quote = quotations.find((q) => q.id === id);
  const [langPick, setDocLang] = React.useState<Locale | null>(null);

  if (!quote) return <EmptyState icon={FileQuestion} title="Quotation not found" help="It may have been removed, or the link is old." action={<Button variant="primary" asChild><Link href="/orders?tab=quotations">All quotations</Link></Button>} />;

  const client = clients.find((c) => c.id === quote.clientId);
  const order = orders.find((o) => o.quotationId === quote.id);
  const totalsOf = (q: Quotation) => priceQuote(q, items, packages, tenant.slabs);
  const totals = totalsOf(quote);
  const versions = quotations.filter((q) => q.groupId === quote.groupId).sort((a, b) => b.version - a.version);
  const previous = versions.find((v) => v.version === quote.version - 1);
  const doc = { ...quote, clientName: client?.name ?? "", clientPhone: client?.phone, date: quote.createdAt };
  // The client's language until someone picks another.
  const docLang: Locale = langPick ?? client?.language ?? "en";
  const expiresIn = daysFromToday(quote.validUntil);
  const active = !["superseded", "rejected"].includes(quote.status);

  const setStatus = (status: QuoteStatus, message: string) => {
    const before = quote.status;
    setQuoteStatus(quote.id, status);
    toast(message, { action: { label: "Undo", onClick: () => setQuoteStatus(quote.id, before) } });
  };
  const send = () => {
    logWhatsApp("quotation", client?.name ?? "", client?.phone ?? "", quoteShareText(tenant.name, doc, totals.grand))();
    window.open(whatsappLink(client?.phone ?? "", quoteShareText(tenant.name, doc, totals.grand)), "_blank", "noopener");
    if (quote.status === "draft" || quote.status === "changes") setStatus("sent", "Marked as sent");
  };
  const convert = async () => {
    try {
      const orderId = await convertToOrder(quote.id);
      toast.success("Approved and booked", { description: "The order stays tentative until the advance is recorded." });
      router.push(`/orders/${orderId}`);
    } catch (e) {
      toast.error("The order was not created", { description: e instanceof Error ? e.message : undefined });
    }
  };

  // Each version stores its own copy of the functions, so versions are matched by function name.
  const diff = previous && {
    total: totals.grand - totalsOf(previous).grand,
    added: quote.functions.flatMap((f) => f.itemIds.filter((i) => !previous.functions.find((p) => p.name === f.name)?.itemIds.includes(i)).map((i) => `${items.find((x) => x.id === i)?.name} (${f.name})`)),
    removed: previous.functions.flatMap((p) => p.itemIds.filter((i) => !quote.functions.find((f) => f.name === p.name)?.itemIds.includes(i)).map((i) => `${items.find((x) => x.id === i)?.name} (${p.name})`)),
    pax: quote.functions.map((f) => ({ f, was: previous.functions.find((p) => p.name === f.name)?.pax })).filter((x) => x.was !== undefined && x.was !== x.f.pax),
  };

  const primary =
    order ? <Button variant="primary" size="lg" asChild><Link href={`/orders/${order.id}`}>Open order {order.number}<ArrowRight strokeWidth={1.75} /></Link></Button>
    : quote.status === "pending_approval" ? (user.role === "owner" ? <Button variant="primary" size="lg" onClick={() => setStatus("draft", "Discount approved")}><ShieldCheck strokeWidth={1.75} />Approve discount</Button> : null)
    : active ? <Button variant="primary" size="lg" onClick={convert}><ClipboardCheck strokeWidth={1.75} />Client approved, book it</Button>
    : null;
  const sendButton = !order && (quote.status === "draft" || quote.status === "changes") ? <Button size="lg" onClick={send}><Send strokeWidth={1.75} />Send on WhatsApp</Button> : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-3 print:hidden">
          <Button variant="ghost" size="icon" asChild aria-label="Back to quotations"><Link href="/orders?tab=quotations"><ArrowLeft strokeWidth={1.75} /></Link></Button>
          <div className="min-w-0 flex-1">
            <h1 className="tnum flex flex-wrap items-center gap-2 font-heading text-2xl font-bold">{quote.number}{quote.version > 1 && <Badge>v{quote.version}</Badge>}<StatusBadge status={quote.status} /></h1>
            <p className="truncate text-sm text-text-muted">{client?.name} · {quote.eventType}</p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden"><DocLangPicker value={docLang} onChange={setDocLang} /></div>
        <PdfDownloads kind="quote" id={quote.id} lang={docLang} functions={quote.functions} className="mb-3" />
        <QuoteDocument data={{ ...doc, lang: docLang }} />
      </div>

      <aside className="space-y-4 print:hidden lg:sticky lg:top-20">
        <Card className="space-y-3 p-4">
          {quote.status === "pending_approval" && user.role !== "owner" && <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">Waiting for the owner to approve the {totals.discountPct.toFixed(1)}% discount. It cannot be sent until then.</p>}
          {quote.status === "superseded" && <p className="rounded-lg bg-surface-muted p-3 text-xs text-text-muted">This is an older version. The latest is v{versions[0].version}.</p>}
          {quote.status === "sent" && expiresIn <= 3 && <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">{expiresIn < 0 ? "This quotation has expired." : `Expires ${expiresIn === 0 ? "today" : `in ${expiresIn} days`}. Follow up with the client.`}</p>}
          {(primary || sendButton) && <div className="flex flex-col gap-2">{primary}{sendButton}</div>}
          <div className="grid grid-cols-2 gap-2">
            {active && !order && <Button asChild><Link href={`/booking?revise=${quote.id}`}><PencilLine strokeWidth={1.75} />Revise</Link></Button>}
            <Button onClick={printLight}><Printer strokeWidth={1.75} />Print or PDF</Button>
            {quote.status === "sent" && <Button onClick={send}><Send strokeWidth={1.75} />Send again</Button>}
            {active && !order && quote.status !== "pending_approval" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button><MessageCircleReply strokeWidth={1.75} />Client replied</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setStatus("changes", "Marked as changes asked")}><PencilLine strokeWidth={1.75} />Asked for changes</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setStatus("rejected", "Marked as rejected")}><XCircle strokeWidth={1.75} />Rejected</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-heading text-base font-semibold">Versions</h2>
          <ul className="mt-2 space-y-1">
            {versions.map((v) => (
              <li key={v.id}>
                <Link href={`/quotations/${v.id}`} className={cn("tnum flex h-11 items-center justify-between gap-2 rounded-lg px-2 text-sm hover:bg-surface-muted", v.id === quote.id && "bg-primary-soft text-primary")}>
                  <span>v{v.version} · {fmtDate(v.createdAt, { day: "numeric", month: "short" })}</span><span className="font-medium">{money(totalsOf(v).grand)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {diff && (
            <div className="mt-3 space-y-1 border-t pt-3 text-xs">
              <p className="font-medium">Changed since v{previous.version}</p>
              <p className={cn("tnum", diff.total > 0 ? "text-success" : diff.total < 0 ? "text-danger" : "text-text-muted")}>Total {diff.total === 0 ? "unchanged" : `${diff.total > 0 ? "up" : "down"} by ${money(Math.abs(diff.total))}`}</p>
              {diff.pax.map(({ f, was }) => <p key={f.id} className="tnum text-text-muted">{f.name}: {was} to {f.pax} guests</p>)}
              {diff.added.map((n) => <p key={n} className="text-success">+ {n}</p>)}
              {diff.removed.map((n) => <p key={n} className="text-danger">- {n}</p>)}
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}

export default function QuotationPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <QuotationDetail />
    </React.Suspense>
  );
}
