"use client";

import { Calculator, CalendarCheck, DatabaseZap, PencilLine, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { useEstimates, type Estimate } from "@/lib/estimates";
import { priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import { fmtDate, money, num } from "@/lib/utils";

/** Cost Calculator: saved calculations of a menu and its extras, each opened again, booked or deleted. */
export default function CalculatorPage() {
  const { ready, loaded, list, load, remove } = useEstimates();
  const { items, packages, tenant, users } = useStore();
  const owner = useStore((s) => s.myRole === "owner");
  const [deleting, setDeleting] = React.useState<Estimate | null>(null);
  React.useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Cost Calculator"
        subtitle="Pick a menu and its extras to see the bill, what it costs you and the profit, before any booking. Save a calculation to open it again or turn it into a booking."
        action={<Button variant="primary" asChild><Link href="/estimate"><Plus strokeWidth={2} />New calculation</Link></Button>}
      />
      {loaded && !ready && (
        <Card className="mb-4 flex items-start gap-3 border-warning/40 bg-warning/5 p-4 text-sm">
          <DatabaseZap className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.75} />
          <p>{owner ? "Run supabase/migrations/0028_category_price_estimates.sql in the Supabase SQL editor to save calculations. You can still work one out without saving." : "Saving calculations needs one database update. Ask the owner to run it."}</p>
        </Card>
      )}
      {!loaded ? <Skeleton className="h-64 rounded-xl" /> : list.length === 0 ? (
        <EmptyState icon={Calculator} title="No calculations yet" help="Start one to price a menu and its extras and see the profit, without making a booking." action={<Button variant="primary" asChild><Link href="/estimate"><Plus strokeWidth={2} />New calculation</Link></Button>} />
      ) : (
        <Card className="divide-y">
          {list.map((e) => {
            const t = priceQuote({ ...e.draft, gstRate: tenant.gstRate, gstInclusive: tenant.gstInclusive }, items, packages, tenant.slabs);
            const dishes = new Set(e.draft.functions.flatMap((f) => f.itemIds)).size;
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
                <Link href={`/estimate?id=${e.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium" data-no-title-case>{e.name}</span>
                  <span className="tnum block text-xs text-text-muted">{e.draft.eventType} · {e.draft.functions.length} {e.draft.functions.length === 1 ? "service" : "services"} · {num(t.pax)} guests · {dishes} dishes · saved {fmtDate(e.updatedAt.slice(0, 10), { day: "numeric", month: "short" })}{users.find((u) => u.id === e.createdBy) ? ` by ${users.find((u) => u.id === e.createdBy)!.name}` : ""}</span>
                </Link>
                <span className="tnum text-right"><span className="block font-heading text-lg font-semibold">{money(t.grand)}</span><span className="block text-xs text-text-muted">bill with GST</span></span>
                <div className="flex gap-1">
                  <Button variant="ghost" asChild><Link href={`/estimate?id=${e.id}`}><PencilLine strokeWidth={1.75} />Open</Link></Button>
                  <Button variant="ghost" asChild><Link href={`/booking?estimate=${e.id}`}><CalendarCheck strokeWidth={1.75} />Book it</Link></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${e.name}`} onClick={() => setDeleting(e)}><Trash2 strokeWidth={1.75} /></Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
      <Modal open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete "${deleting?.name ?? ""}"?`} description="The calculation is removed. Bookings made from it stay as they are."
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={() => { if (deleting) { remove(deleting.id); toast.success("Calculation deleted"); } setDeleting(null); }}>Delete</Button></>}>{null}</Modal>
    </>
  );
}
