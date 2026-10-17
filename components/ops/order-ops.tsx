"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/shared/badges";
import { ProgressBar } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { checkSteps, issueKinds, transportCost, useOps } from "@/lib/operations";
import type { Order } from "@/lib/types";
import { fmtDate, fmtTime, money, num } from "@/lib/utils";
import { FunctionTrips } from "./dispatch";

/** Order tab: trips and transport cost per function, and how each function went on the day. */
export function OrderOps({ order }: { order: Order }) {
  const trips = useOps((s) => s.trips);
  const onsite = useOps((s) => s.onsite);
  const issues = useOps((s) => s.issues);
  const functions = [...order.functions].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const cost = transportCost(trips, order.id);
  return (
    <div className="space-y-6">
      <p className="tnum rounded-xl border bg-surface px-4 py-3 text-sm">Transport cost for this order <span className="float-right font-heading font-bold">{money(cost)}</span></p>
      {functions.map((fn) => {
        const rec = onsite[fn.id];
        const done = checkSteps.filter((s) => rec?.checklist[s.id]).length;
        const fnIssues = issues.filter((i) => i.functionId === fn.id);
        return (
          <Card key={fn.id} className="space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold">{fn.name}</h3>
                <p className="tnum text-sm text-text-muted">{fmtDate(fn.date, { weekday: "short", day: "numeric", month: "short" })}, serve {fmtTime(fn.time)} · {num(fn.pax)} guests · {fn.venue}</p>
              </div>
              <Button asChild><Link href={`/onsite?fn=${fn.id}`}><ClipboardCheck strokeWidth={1.75} />Event-day screen</Link></Button>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="text-text-muted">Checklist</p>
                <p className="tnum font-medium">{done} of {checkSteps.length}</p>
                <ProgressBar value={(done / checkSteps.length) * 100} className="mt-2 h-1.5" label="Checklist" />
              </div>
              <div className="rounded-xl bg-surface-muted p-3"><p className="text-text-muted">Guests served</p><p className="tnum font-medium">{rec?.guests ? `${num(rec.guests)} of ${num(fn.pax)} booked` : "Not counted yet"}</p></div>
              <div className="rounded-xl bg-surface-muted p-3"><p className="text-text-muted">Client sign-off</p><p className="font-medium">{rec?.signedAt ? <span className="text-success">Signed by {rec.signoffName}</span> : "Not yet"}</p></div>
            </div>
            {fnIssues.length > 0 && (
              <ul className="space-y-1 text-sm">
                {fnIssues.map((i) => <li key={i.id} className="flex items-start gap-2">{i.resolved ? <Badge tone="success">Resolved</Badge> : <Badge tone="danger">Open</Badge>}<span><span className="font-medium">{issueKinds.find((k) => k.id === i.kind)?.label}:</span> {i.note}</span></li>)}
              </ul>
            )}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Trips</p>
              <FunctionTrips order={order} fn={fn} showHead={false} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** Dashboard card: problems reported from venues that nobody has closed. */
export function OpenIssues() {
  const ready = useOps((s) => s.ready);
  const issues = useOps((s) => s.issues);
  const open = issues.filter((i) => !i.resolved);
  if (!ready || open.length === 0) return null;
  return (
    <Card className="border-danger/40">
      <p className="px-4 pt-4 font-heading font-semibold md:px-5">Open issues at events <Badge tone="danger">{open.length}</Badge></p>
      <ul className="mt-2 divide-y">
        {open.slice(-5).reverse().map((i) => (
          <li key={i.id}>
            <Link href={`/onsite?fn=${i.functionId}`} className="block px-4 py-2.5 text-sm hover:bg-surface-muted/60 md:px-5">
              <span className="font-medium">{issueKinds.find((k) => k.id === i.kind)?.label}</span>
              <span className="block truncate text-text-muted">{i.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
