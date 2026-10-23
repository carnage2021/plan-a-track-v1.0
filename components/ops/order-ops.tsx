"use client";

import { ClipboardCheck, Plus } from "lucide-react";
import * as React from "react";
import { ExpenseSheet } from "@/components/expenses/expense-sheet";
import { categoryLabel, useExpenses } from "@/lib/expenses";
import Link from "next/link";
import { Badge } from "@/components/shared/badges";
import { ProgressBar, ServiceLabel } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { checkSteps, issueKinds, transportCost, useOps } from "@/lib/operations";
import type { Order } from "@/lib/types";
import { fmtDate, money, num } from "@/lib/utils";
import { FunctionTrips } from "./dispatch";

/** Running costs of an event that are not vendor bills: transport and the expenses logged against it. */
function EventCosts({ order, transport }: { order: Order; transport: number }) {
  const ready = useExpenses((s) => s.ready);
  const mine = useExpenses((s) => s.expenses).filter((e) => e.orderId === order.id);
  const [add, setAdd] = React.useState(false);
  const spent = mine.reduce((s, e) => s + e.amount, 0);
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="tnum flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><dt className="text-xs text-text-muted">Transport</dt><dd className="font-heading text-lg font-bold">{money(transport)}</dd></div>
          {ready && <div><dt className="text-xs text-text-muted">Expenses</dt><dd className="font-heading text-lg font-bold">{money(spent)}</dd></div>}
          {ready && <div><dt className="text-xs text-text-muted">Total running cost</dt><dd className="font-heading text-lg font-bold">{money(transport + spent)}</dd></div>}
        </dl>
        {ready && <Button onClick={() => setAdd(true)}><Plus strokeWidth={1.75} />Add expense</Button>}
      </div>
      {mine.length > 0 && <ul className="tnum mt-3 divide-y border-t text-sm">{mine.map((e) => <li key={e.id} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{categoryLabel(e.category)}{e.paidTo && ` · ${e.paidTo}`}<span className="block text-xs text-text-muted">{e.number} · {fmtDate(e.date, { day: "numeric", month: "short" })}{e.photoPath ? " · bill attached" : ""}</span></span><span className="shrink-0 font-medium">{money(e.amount)}</span></li>)}</ul>}
      <ExpenseSheet open={add} onOpenChange={setAdd} orderId={order.id} />
    </Card>
  );
}

/** Order tab: trips and transport cost per function, and how each function went on the day. */
export function OrderOps({ order }: { order: Order }) {
  const trips = useOps((s) => s.trips);
  const onsite = useOps((s) => s.onsite);
  const issues = useOps((s) => s.issues);
  const functions = [...order.functions].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const cost = transportCost(trips, order.id);
  return (
    <div className="space-y-6">
      <EventCosts order={order} transport={cost} />
      {functions.map((fn) => {
        const rec = onsite[fn.id];
        const done = checkSteps.filter((s) => rec?.checklist[s.id]).length;
        const fnIssues = issues.filter((i) => i.functionId === fn.id);
        return (
          <Card key={fn.id} className="space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold">{fn.name}</h3>
                <p className="tnum text-sm text-text-muted">{fmtDate(fn.date, { weekday: "short", day: "numeric", month: "short" })}, <ServiceLabel fn={fn} /> · {num(fn.pax)} guests · {fn.venue}</p>
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
