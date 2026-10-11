"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/primitives";
import { priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import { daysFromToday, fmtDate, money, num } from "@/lib/utils";

const filters = [
  { id: "open", label: "Open" },
  { id: "draft", label: "Drafts" },
  { id: "sent", label: "Sent" },
  { id: "approved", label: "Approved" },
  { id: "all", label: "All versions" },
];

export default function QuotationsPage() {
  const router = useRouter();
  const { quotations, clients, items, packages, tenant } = useStore();
  const hasDraft = useStore((s) => !!s.drafts.builder);
  const [filter, setFilter] = React.useState("open");

  const rows = React.useMemo(
    () =>
      quotations
        .filter((q) => (filter === "all" ? true : filter === "open" ? !["superseded", "rejected"].includes(q.status) : filter === "draft" ? ["draft", "pending_approval"].includes(q.status) : q.status === filter))
        .map((q) => ({ q, client: clients.find((c) => c.id === q.clientId), totals: priceQuote(q, items, packages, tenant.slabs), first: [...q.functions].sort((a, b) => a.date.localeCompare(b.date))[0] })),
    [quotations, clients, items, packages, tenant.slabs, filter],
  );

  return (
    <>
      <PageHeader title="Quotations" subtitle="Every version is kept; only the latest stays active." action={<Button variant="primary" asChild><Link href="/quotations/new"><Plus strokeWidth={2} /><span className="max-sm:hidden">{hasDraft ? "Continue draft" : "New quotation"}</span></Link></Button>}>
        {filters.map((f) => <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>)}
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No quotations here" help="Start from an enquiry or build one from scratch with the photo menu." action={<Button variant="primary" asChild><Link href="/quotations/new">New quotation</Link></Button>} />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-14 bg-surface-muted text-left text-xs text-text-muted">
                <tr>{["Quotation", "Client", "Event", "Guests", "Total", "Valid until", "Status"].map((h, i) => <th key={h} className={`px-4 py-3 font-medium ${i === 3 || i === 4 ? "text-right" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ q, client, totals, first }) => (
                  <tr key={q.id} tabIndex={0} onClick={() => router.push(`/quotations/${q.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/quotations/${q.id}`)} className="cursor-pointer hover:bg-surface-muted/60">
                    <td className="tnum px-4 py-3 font-medium">{q.number}{q.version > 1 && <span className="ml-1 text-xs text-text-muted">v{q.version}</span>}</td>
                    <td className="px-4 py-3">{client?.name}</td>
                    <td className="px-4 py-3 text-text-muted">{q.eventType} · {first ? fmtDate(first.date, { day: "numeric", month: "short" }) : ""}{q.functions.length > 1 ? ` +${q.functions.length - 1}` : ""}</td>
                    <td className="tnum px-4 py-3 text-right">{num(totals.pax)}</td>
                    <td className="tnum px-4 py-3 text-right font-medium">{money(totals.grand)}</td>
                    <td className={`tnum px-4 py-3 ${daysFromToday(q.validUntil) < 3 && q.status === "sent" ? "text-warning" : "text-text-muted"}`}>{fmtDate(q.validUntil, { day: "numeric", month: "short" })}</td>
                    <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
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
                  <div className="tnum mt-3 flex items-end justify-between text-sm">
                    <span className="text-text-muted">{first ? fmtDate(first.date, { day: "numeric", month: "short" }) : ""} · {num(totals.pax)} guests</span>
                    <span className="font-heading text-lg font-bold">{money(totals.grand)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
