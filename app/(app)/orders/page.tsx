"use client";

import { ClipboardList, Presentation, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { StatusBadge } from "@/components/shared/badges";
import { QuotationList } from "@/components/sales/quotation-list";
import { EmptyState, EventCard, PageHeader, ProgressBar } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, Chip, Skeleton } from "@/components/ui/primitives";
import { paidAmount, priceQuote } from "@/lib/pricing";
import { useCurrentUser, useStore } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";
import { fmtDate, money, num } from "@/lib/utils";

const filters: { id: OrderStatus | "upcoming" | "due" | "all" | "quotations"; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "tentative", label: "Tentative" },
  { id: "due", label: "Balance due" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
  { id: "quotations", label: "Quotations" },
];

function Orders() {
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get("client");
  const { orders, clients, items, packages, tenant } = useStore();
  const role = useCurrentUser().role;
  // Quotations are for the people who sell; operations and accounts see orders only.
  const sells = role === "owner" || role === "sales";
  const quoteCount = useStore((s) => s.quotations.filter((q) => !["superseded", "rejected"].includes(q.status) && !s.orders.some((o) => o.quotationId === q.id)).length);
  const [filter, setFilter] = React.useState<(typeof filters)[number]["id"]>(params.get("tab") === "quotations" && sells ? "quotations" : clientId ? "all" : "upcoming");
  const client = clients.find((c) => c.id === clientId);

  const rows = React.useMemo(
    () =>
      orders
        .map((o) => {
          const total = priceQuote(o, items, packages, tenant.slabs);
          const paid = paidAmount(o.payments);
          const dates = o.functions.map((f) => f.date).sort();
          return { o, client: clients.find((c) => c.id === o.clientId), total, paid, due: Math.max(0, total.grand - paid), first: dates[0], last: dates[dates.length - 1] };
        })
        .filter((r) => !clientId || r.o.clientId === clientId)
        .filter((r) => (filter === "all" ? true : filter === "upcoming" ? ["tentative", "confirmed", "in_progress"].includes(r.o.status) : filter === "due" ? r.due > 0 && r.o.status !== "cancelled" : r.o.status === filter))
        .sort((a, b) => (filter === "completed" || filter === "all" ? b.first.localeCompare(a.first) : a.first.localeCompare(b.first))),
    [orders, clients, items, packages, tenant.slabs, filter, clientId],
  );

  return (
    <>
      <PageHeader title="Orders" subtitle={filter === "quotations" ? "Quotations saved at the end of a booking. Approve one when the client says yes, and it becomes an order." : client ? `Showing orders for ${client.name}` : "Bookings, and the quotations waiting for the client."} action={<Button variant="primary" asChild><Link href="/booking"><Presentation strokeWidth={1.75} /><span className="max-sm:hidden">New booking</span></Link></Button>}>
        {client && <Chip active onClick={() => router.replace("/orders")}>{client.name}<X strokeWidth={1.75} /></Chip>}
        {filters.filter((f) => f.id !== "quotations" || sells).map((f) => <Chip key={f.id} active={filter === f.id} onClick={() => { setFilter(f.id); router.replace(f.id === "quotations" ? "/orders?tab=quotations" : clientId ? `/orders?client=${clientId}` : "/orders"); }}>{f.label}{f.id === "quotations" && quoteCount > 0 ? ` ${quoteCount}` : ""}</Chip>)}
      </PageHeader>

      {filter === "quotations" ? (
        <QuotationList clientId={clientId} />
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No orders in this view" help="Orders appear here when you confirm a booking, or approve a saved quotation." action={<Button variant="primary" asChild><Link href="/booking">New booking</Link></Button>} />
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-text-muted">
                <tr>{["Order", "Client", "Event dates", "Functions", "Guests", "Total", "Payment", "Status"].map((h, i) => <th key={h} className={`px-4 py-3 font-medium ${i === 4 || i === 5 ? "text-right" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ o, client: c, total, paid, first, last }) => (
                  <tr key={o.id} tabIndex={0} onClick={() => router.push(`/orders/${o.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/orders/${o.id}`)} className="cursor-pointer hover:bg-surface-muted/60">
                    <td className="tnum px-4 py-3 font-medium">{o.number}</td>
                    <td className="px-4 py-3">{c?.name}<span className="block text-xs text-text-muted">{o.eventType}</span></td>
                    <td className="tnum px-4 py-3 text-text-muted">{fmtDate(first, { day: "numeric", month: "short" })}{last !== first ? ` to ${fmtDate(last, { day: "numeric", month: "short" })}` : ""}</td>
                    <td className="max-w-48 truncate px-4 py-3 text-text-muted">{o.functions.map((f) => f.name).join(", ")}</td>
                    <td className="tnum px-4 py-3 text-right">{num(total.pax)}</td>
                    <td className="tnum px-4 py-3 text-right font-medium">{money(total.grand)}</td>
                    <td className="w-40 px-4 py-3">
                      <ProgressBar value={total.grand ? (paid / total.grand) * 100 : 0} tone={paid >= total.grand ? "success" : "warning"} label="Payment received" />
                      <span className="tnum mt-1 block text-xs text-text-muted">{paid >= total.grand ? "Paid in full" : `${money(total.grand - paid)} due`}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
            {rows.map(({ o }) => <EventCard key={o.id} order={o} />)}
          </div>
        </>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Orders />
    </React.Suspense>
  );
}
