"use client";

import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import * as React from "react";
import { EmptyState, PageHeader } from "@/components/shared/blocks";
import { OpsGate } from "@/components/ops/common";
import { FunctionTrips, VehicleSheet } from "@/components/ops/dispatch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOps } from "@/lib/operations";
import { useStore } from "@/lib/store";
import { addDays, fmtDate, isoDate, money, num, parseDate } from "@/lib/utils";

export default function DispatchPage() {
  const [date, setDate] = React.useState(() => isoDate(new Date()));
  const [vehiclesOpen, setVehiclesOpen] = React.useState(false);
  const orders = useStore((s) => s.orders);
  const trips = useOps((s) => s.trips);
  const ready = useOps((s) => s.ready);
  const isToday = date === isoDate(new Date());
  const step = (n: number) => setDate(isoDate(addDays(parseDate(date), n)));

  const day = React.useMemo(
    () =>
      orders
        .filter((o) => o.status !== "cancelled" && o.status !== "tentative")
        .flatMap((o) => o.functions.filter((f) => f.date === date).map((fn) => ({ order: o, fn })))
        .sort((a, b) => a.fn.time.localeCompare(b.fn.time)),
    [orders, date],
  );
  const ids = new Set(day.map((d) => d.fn.id));
  const todays = trips.filter((t) => ids.has(t.functionId));
  const tiles = [
    ["Functions", num(day.length)],
    ["Trips planned", num(todays.length)],
    ["Delivered", `${todays.filter((t) => t.status === "delivered").length} of ${todays.length}`],
    ["Transport cost", money(todays.reduce((s, t) => s + t.cost, 0))],
  ];

  return (
    <>
      <PageHeader title="Dispatch" subtitle="Plan each vehicle run, tick the load at the kitchen door and confirm delivery at the venue." action={ready && <Button onClick={() => setVehiclesOpen(true)}><Truck strokeWidth={1.75} />Vehicles</Button>} />
      <OpsGate>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon-lg" aria-label="Previous day" onClick={() => step(-1)}><ChevronLeft strokeWidth={1.75} /></Button>
          <Input type="date" aria-label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto" />
          <Button variant="ghost" size="icon-lg" aria-label="Next day" onClick={() => step(1)}><ChevronRight strokeWidth={1.75} /></Button>
          {!isToday && <Button variant="ghost" onClick={() => setDate(isoDate(new Date()))}>Today</Button>}
          <p className="tnum ml-auto text-sm text-text-muted">{fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        {day.length === 0 ? (
          <div className="mt-6"><EmptyState icon={Truck} title="No functions on this day" help="Functions from confirmed orders show here on their date, ready for trips to be planned. Tentative orders are left out until the advance is in." /></div>
        ) : (
          <>
            <dl className="tnum mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tiles.map(([k, v]) => <div key={k} className="rounded-xl border bg-surface p-4"><dt className="text-xs text-text-muted">{k}</dt><dd className="font-heading text-2xl font-bold">{v}</dd></div>)}
            </dl>
            <div className="mt-6 space-y-8">{day.map(({ order, fn }) => <FunctionTrips key={fn.id} order={order} fn={fn} />)}</div>
          </>
        )}
      </OpsGate>
      <VehicleSheet open={vehiclesOpen} onOpenChange={setVehiclesOpen} />
    </>
  );
}
