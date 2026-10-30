"use client";

import { CheckCircle2, FileText, Presentation } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Quotation } from "@/lib/types";
import { daysFromToday, fmtDate, money, num } from "@/lib/utils";

/** A saved quotation can be approved once the owner has passed any large discount, and only once. */
const canApprove = (q: Quotation) => !["pending_approval", "superseded", "rejected"].includes(q.status);

/**
 * Quotations saved at the end of a booking, waiting for the client. Approve turns one into an order, which then
 * runs through the same flow as a booking confirmed on the spot.
 */
export function QuotationList({ clientId }: { clientId?: string | null }) {
  const router = useRouter();
  const { quotations, orders, clients, items, packages, tenant } = useStore();
  const convertToOrder = useStore((s) => s.convertToOrder);
  const [busy, setBusy] = React.useState("");

  const rows = React.useMemo(
    () =>
      quotations
        // Older versions and quotations already booked stay out of the way; each one's page keeps its history.
        .filter((q) => !["superseded", "rejected"].includes(q.status) && !orders.some((o) => o.quotationId === q.id))
        .filter((q) => !clientId || q.clientId === clientId)
        .map((q) => ({ q, client: clients.find((c) => c.id === q.clientId), totals: priceQuote(q, items, packages, tenant.slabs), first: [...q.functions].sort((a, b) => a.date.localeCompare(b.date))[0] })),
    [quotations, orders, clients, items, packages, tenant.slabs, clientId],
  );

  const approve = async (q: Quotation) => {
    setBusy(q.id);
    try {
      const orderId = await convertToOrder(q.id);
      toast.success("Approved and booked", { description: "The order stays tentative until the advance is recorded." });
      router.push(`/orders/${orderId}`);
    } catch (e) {
      toast.error("The order was not created", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy("");
    }
  };
  const approveButton = (q: Quotation) =>
    canApprove(q) ? (
      <Button variant="primary" loading={busy === q.id} disabled={!!busy} onClick={(e) => { e.stopPropagation(); e.preventDefault(); approve(q); }}><CheckCircle2 strokeWidth={1.75} />Approve</Button>
    ) : null;

  if (!rows.length)
    return <EmptyState icon={FileText} title="No quotations waiting" help="At the end of a booking, choose Save as quotation. It waits here until the client approves." action={<Button variant="primary" asChild><Link href="/booking"><Presentation strokeWidth={1.75} />New booking</Link></Button>} />;

  return (
    <>
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs text-text-muted">
            <tr>{["Quotation", "Client", "Event", "Guests", "Total", "Valid until", "Status", ""].map((h, i) => <th key={h || i} className={`px-4 py-3 font-medium ${i === 3 || i === 4 ? "text-right" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ q, client, totals, first }) => (
              <tr key={q.id} tabIndex={0} onClick={() => router.push(`/quotations/${q.id}`)} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && router.push(`/quotations/${q.id}`)} className="cursor-pointer hover:bg-surface-muted/60">
                <td className="tnum px-4 py-3 font-medium">{q.number}{q.version > 1 && <span className="ml-1 text-xs text-text-muted">v{q.version}</span>}</td>
                <td className="px-4 py-3">{client?.name}</td>
                <td className="px-4 py-3 text-text-muted">{q.eventType} · {first ? fmtDate(first.date, { day: "numeric", month: "short" }) : ""}{q.functions.length > 1 ? ` +${q.functions.length - 1}` : ""}</td>
                <td className="tnum px-4 py-3 text-right">{num(totals.pax)}</td>
                <td className="tnum px-4 py-3 text-right font-medium">{money(totals.grand)}</td>
                <td className={`tnum px-4 py-3 ${daysFromToday(q.validUntil) < 3 ? "text-warning" : "text-text-muted"}`}>{fmtDate(q.validUntil, { day: "numeric", month: "short" })}</td>
                <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                <td className="px-4 py-2 text-right">{approveButton(q)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <ul className="space-y-3 md:hidden">
        {rows.map(({ q, client, totals, first }) => (
          <li key={q.id}>
            <Link href={`/quotations/${q.id}`} className="block rounded-xl border bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-heading text-base font-semibold">{client?.name}</p>
                  <p className="tnum truncate text-xs text-text-muted">{q.number}{q.version > 1 ? ` · v${q.version}` : ""} · {q.eventType}</p>
                </div>
                <StatusBadge status={q.status} />
              </div>
              <div className="tnum mt-3 flex items-end justify-between gap-2 text-sm">
                <span className="text-text-muted">{first ? fmtDate(first.date, { day: "numeric", month: "short" }) : ""} · {num(totals.pax)} guests</span>
                <span className="font-heading text-lg font-bold">{money(totals.grand)}</span>
              </div>
              {canApprove(q) && <div className="mt-3 flex justify-end">{approveButton(q)}</div>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
