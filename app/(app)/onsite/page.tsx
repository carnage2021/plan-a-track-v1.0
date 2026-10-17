"use client";

import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, MapPin } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/shared/badges";
import { EmptyState, PageHeader, ProgressBar } from "@/components/shared/blocks";
import { OpsGate } from "@/components/ops/common";
import { OnsiteView } from "@/components/ops/onsite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/primitives";
import { checkSteps, useOps } from "@/lib/operations";
import { useStore } from "@/lib/store";
import { addDays, fmtTime, isoDate, num, parseDate } from "@/lib/utils";

function DayList({ onPick }: { onPick: (id: string) => void }) {
  const [date, setDate] = React.useState(() => isoDate(new Date()));
  const { orders, clients } = useStore();
  const onsite = useOps((s) => s.onsite);
  const issues = useOps((s) => s.issues);
  const step = (n: number) => setDate(isoDate(addDays(parseDate(date), n)));
  const day = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "tentative")
    .flatMap((o) => o.functions.filter((f) => f.date === date).map((fn) => ({ order: o, fn })))
    .sort((a, b) => a.fn.time.localeCompare(b.fn.time));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon-lg" aria-label="Previous day" onClick={() => step(-1)}><ChevronLeft strokeWidth={1.75} /></Button>
        <Input type="date" aria-label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto" />
        <Button variant="ghost" size="icon-lg" aria-label="Next day" onClick={() => step(1)}><ChevronRight strokeWidth={1.75} /></Button>
        {date !== isoDate(new Date()) && <Button variant="ghost" onClick={() => setDate(isoDate(new Date()))}>Today</Button>}
      </div>
      {day.length === 0 ? (
        <div className="mt-6"><EmptyState icon={ClipboardCheck} title="No functions on this day" help="Pick the day of the event. Each confirmed function on it opens as a screen for the supervisor at the venue." /></div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {day.map(({ order, fn }) => {
            const rec = onsite[fn.id];
            const done = checkSteps.filter((s) => rec?.checklist[s.id]).length;
            const open = issues.filter((i) => i.functionId === fn.id && !i.resolved).length;
            return (
              <li key={fn.id}>
                <button type="button" onClick={() => onPick(fn.id)} className="w-full rounded-2xl border bg-surface p-4 text-left transition-colors hover:border-primary">
                  <p className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold">
                    {clients.find((c) => c.id === order.clientId)?.name} · {fn.name}
                    {rec?.signedAt ? <Badge tone="success"><CheckCircle2 />Signed off</Badge> : done > 0 ? <Badge tone="primary">Live</Badge> : null}
                    {open > 0 && <Badge tone="danger">{open} open {open === 1 ? "issue" : "issues"}</Badge>}
                  </p>
                  <p className="tnum mt-1 flex flex-wrap gap-x-3 text-sm text-text-muted"><span>Serve {fmtTime(fn.time)}</span><span>{num(fn.pax)} guests</span><span className="inline-flex items-center gap-1"><MapPin className="size-3.5" strokeWidth={1.75} />{fn.venue}</span></p>
                  <div className="tnum mt-3 flex items-center gap-3 text-xs text-text-muted"><ProgressBar value={(done / checkSteps.length) * 100} className="h-1.5 flex-1" label="Checklist" />{done} of {checkSteps.length}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Onsite() {
  const router = useRouter();
  const fnId = useSearchParams().get("fn");
  const orders = useStore((s) => s.orders);
  const hit = fnId ? orders.flatMap((o) => o.functions.map((fn) => ({ order: o, fn }))).find((x) => x.fn.id === fnId) : undefined;
  const go = (id?: string) => router.push(id ? `/onsite?fn=${id}` : "/onsite");
  if (hit)
    return (
      <>
        <Button variant="ghost" className="mb-3 -ml-2" onClick={() => go()}><ArrowLeft strokeWidth={1.75} />All functions</Button>
        <OnsiteView order={hit.order} fn={hit.fn} />
      </>
    );
  return (
    <>
      <PageHeader title="Event day" subtitle="The supervisor's screen at the venue: checklist, guest count, issues and the client's sign-off." />
      <DayList onPick={go} />
    </>
  );
}

export default function OnsitePage() {
  return (
    <OpsGate>
      <React.Suspense fallback={<Skeleton className="h-64" />}>
        <Onsite />
      </React.Suspense>
    </OpsGate>
  );
}
