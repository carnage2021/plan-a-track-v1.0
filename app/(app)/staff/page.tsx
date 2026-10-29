"use client";

import { CalendarOff, ListChecks, Plus, Printer, Users, Wallet } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { paymentModes } from "@/components/sales/payment-sheet";
import { Badge } from "@/components/shared/badges";
import { Avatar, EmptyState, MoneyInput, PageHeader } from "@/components/shared/blocks";
import { StaffGate, nextLabel, nextStatus } from "@/components/staff/order-tasks";
import { Num } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Chip, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Modal, Sheet } from "@/components/ui/sheet";
import { netSalary, statusFlow, statusLabel, taskAmount, typeLabel, useStaff, workerBalance, workerRoles, type SalarySlip, type Worker, type WorkerType } from "@/lib/staff";
import { useCurrentUser, useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import type { PaymentMode } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { cn, fmtDate, isoDate, missingFirst, money } from "@/lib/utils";
import { useAccess } from "@/lib/access";

function WorkerSheet({ worker, onClose }: { worker?: Worker; onClose: () => void }) {
  const saveWorker = useStaff((s) => s.saveWorker);
  const toggleLeave = useStaff((s) => s.toggleLeave);
  const leaves = useStaff((s) => s.leaves);
  const vendors = useSupply((s) => s.vendors);
  const [form, setForm] = React.useState<Omit<Worker, "id">>(() => worker ?? { name: "", phone: "", role: "Helper", type: "daily", skills: [], rateDay: 0, rateEvent: 0, overtimeRate: 0, monthlySalary: 0, idProof: "", upi: "", rating: 0, active: true });
  const [leaveDate, setLeaveDate] = React.useState(isoDate(new Date()));
  const mine = worker ? leaves.filter((l) => l.workerId === worker.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const contractors = vendors.filter((v) => v.type === "labour");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={worker ? worker.name : "Add worker"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!form.name.trim()} onClick={() => { saveWorker({ ...form, name: form.name.trim(), id: worker?.id }); toast.success(worker ? "Worker updated" : "Worker added"); onClose(); }}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Phone"><Input inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Role"><Select value={form.role} onChange={(e) => set("role", e.target.value)}>{[...new Set([...workerRoles, form.role])].map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Type"><Select value={form.type} onChange={(e) => set("type", e.target.value as WorkerType)}>{(Object.keys(typeLabel) as WorkerType[]).map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}</Select></Field>
        {form.type === "contractor" ? (
          <Field label="Supplied by" hint={contractors.length ? undefined : "Add a Labour contractor on the Vendors page."}><Select value={form.contractorId ?? ""} onChange={(e) => set("contractorId", e.target.value || undefined)}><option value="">Choose a contractor</option>{contractors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        ) : form.type === "salaried" ? (
          <Field label="Monthly salary"><MoneyInput value={form.monthlySalary} onChange={(v) => set("monthlySalary", v)} /></Field>
        ) : <span />}
        <Field label="Rate per day"><MoneyInput value={form.rateDay} onChange={(v) => set("rateDay", v)} /></Field>
        <Field label="Rate per event" hint="Used as the task price."><MoneyInput value={form.rateEvent} onChange={(v) => set("rateEvent", v)} /></Field>
        <Field label="Overtime per hour"><MoneyInput value={form.overtimeRate} onChange={(v) => set("overtimeRate", v)} /></Field>
        <Field label="Rating"><Select value={form.rating} onChange={(e) => set("rating", Number(e.target.value))}>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n ? `${n} of 5` : "Not rated"}</option>)}</Select></Field>
        <Field label="Skills" hint="Separate with commas." className="col-span-2"><Input value={form.skills.join(", ")} onChange={(e) => set("skills", e.target.value.split(",").map((s) => s.trimStart()).filter((s, i, a) => s || i === a.length - 1))} placeholder="Tandoor, Sweets, Live counter" /></Field>
        <Field label="ID proof number"><Input value={form.idProof} onChange={(e) => set("idProof", e.target.value)} /></Field>
        <Field label="UPI or bank"><Input value={form.upi} onChange={(e) => set("upi", e.target.value)} /></Field>
        <label className="col-span-2 flex items-center justify-between rounded-xl border p-3 text-sm">Available for work<Switch checked={form.active} onCheckedChange={(v) => set("active", v)} label="Available for work" /></label>
      </div>
      {worker && (
        <div className="mt-6">
          <h3 className="font-heading text-base font-semibold">Leave</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input type="date" aria-label="Leave date" className="w-auto flex-1" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
            <Button onClick={() => toggleLeave(worker.id, leaveDate, true)}>Paid leave</Button>
            <Button onClick={() => toggleLeave(worker.id, leaveDate, false)}>Unpaid leave</Button>
          </div>
          <ul className="tnum mt-2 divide-y text-sm">
            {mine.slice(0, 12).map((l) => <li key={l.id} className="flex items-center justify-between py-1.5">{fmtDate(l.date, { weekday: "short", day: "numeric", month: "short" })}<span className="flex items-center gap-2"><Badge tone={l.paid ? "info" : "warning"}>{l.paid ? "Paid" : "Unpaid"}</Badge><Button variant="ghost" onClick={() => toggleLeave(worker.id, l.date, l.paid)}>Remove</Button></span></li>)}
            {mine.length === 0 && <li className="py-2 text-text-muted">No leave marked.</li>}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

function Workers() {
  const { workers, tasks, leaves } = useStaff();
  const [role, setRole] = React.useState("all");
  const [open, setOpen] = React.useState<string | "new" | null>(null);
  const today = isoDate(new Date());
  const roles = [...new Set(workers.map((w) => w.role))];
  const unpaid = (w: Worker) => !(w.rateDay > 0 || w.rateEvent > 0 || w.monthlySalary > 0);
  const shown = missingFirst(workers, (w) => w.name, unpaid).filter((w) => role === "all" || w.role === role);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={role === "all"} onClick={() => setRole("all")}>All<span className="tnum text-xs">{workers.length}</span></Chip>
        {roles.map((r) => <Chip key={r} active={role === r} onClick={() => setRole(r)}>{r}<span className="tnum text-xs">{workers.filter((w) => w.role === r).length}</span></Chip>)}
        <Button className="ml-auto" onClick={() => setOpen("new")}><Plus strokeWidth={1.75} />Worker</Button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((w) => {
          const onLeave = leaves.some((l) => l.workerId === w.id && l.date === today);
          const open = tasks.filter((t) => t.workerId === w.id && t.status !== "verified" && t.status !== "done").length;
          return (
            <button key={w.id} type="button" onClick={() => setOpen(w.id)} className={cn("flex items-start gap-3 rounded-xl border bg-surface p-4 text-left shadow-card hover:border-primary/40", !w.active && "opacity-60")}>
              <Avatar name={w.name} dot={!w.active ? "danger" : onLeave ? "warning" : "success"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-base font-semibold">{w.name}{unpaid(w) && <Badge tone="warning" className="ml-2 align-middle">No rate</Badge>}</span>
                <span className="tnum block truncate text-xs text-text-muted">{w.role} · {typeLabel[w.type]}{w.phone ? ` · ${w.phone}` : ""}</span>
                <span className="mt-2 flex flex-wrap gap-1">{w.skills.filter(Boolean).slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}{onLeave && <Badge tone="warning">On leave today</Badge>}{open > 0 && <Badge tone="primary">{open} open tasks</Badge>}</span>
              </span>
              <span className="tnum shrink-0 text-right text-sm font-semibold">{w.type === "salaried" ? money(w.monthlySalary) : money(w.rateEvent || w.rateDay)}<span className="block text-xs font-normal text-text-muted">{w.type === "salaried" ? "a month" : w.rateEvent ? "an event" : "a day"}</span></span>
            </button>
          );
        })}
      </div>
      {open && <WorkerSheet key={open} worker={workers.find((w) => w.id === open)} onClose={() => setOpen(null)} />}
    </>
  );
}

function Board() {
  const { tasks, workers } = useStaff();
  const patch = useStaff((s) => s.patchTask);
  const orders = useStore((s) => s.orders);
  const clients = useStore((s) => s.clients);
  const [orderId, setOrderId] = React.useState("");
  const withTasks = orders.filter((o) => tasks.some((t) => t.orderId === o.id));
  const label = (id: string) => { const o = orders.find((x) => x.id === id); return `${clients.find((c) => c.id === o?.clientId)?.name ?? ""} · ${o?.eventType ?? ""}`; };
  const shown = tasks.filter((t) => !orderId || t.orderId === orderId);
  if (tasks.length === 0) return <EmptyState icon={ListChecks} title="No tasks yet" help="Open an order, go to its Staff and Tasks tab and press Plan the crew. The task list comes from the guest count." action={<Button variant="primary" asChild><Link href="/orders">Open orders</Link></Button>} />;
  return (
    <>
      <Select aria-label="Order" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="max-w-sm bg-surface"><option value="">All orders</option>{withTasks.map((o) => <option key={o.id} value={o.id}>{label(o.id)}</option>)}</Select>
      <div className="relative -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
        {statusFlow.map((status) => {
          const col = shown.filter((t) => t.status === status);
          return (
            <section key={status} className="flex w-64 shrink-0 flex-col rounded-2xl bg-surface-muted p-2">
              <h2 className="flex items-center justify-between px-2 py-2 text-sm font-semibold">{statusLabel[status]}<span className="tnum rounded-full bg-surface px-2 text-xs font-medium text-text-muted">{col.length}</span></h2>
              <div className="flex min-h-20 flex-col gap-2">
                {col.map((t) => {
                  const w = workers.find((x) => x.id === t.workerId);
                  const order = orders.find((o) => o.id === t.orderId);
                  const next = nextStatus(t.status);
                  return (
                    <article key={t.id} className="rounded-xl border bg-surface p-3 shadow-card">
                      <Link href={`/orders/${t.orderId}?tab=staff`} className="block text-sm font-medium hover:text-primary">{t.title}</Link>
                      <p className="truncate text-xs text-text-muted">{label(t.orderId)} · {order?.functions.find((f) => f.id === t.functionId)?.name}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs">{w ? <><Avatar name={w.name} className="size-6" /><span className="truncate">{w.name}</span></> : <Badge tone="warning">Not assigned</Badge>}</span>
                        <span className="tnum text-xs font-semibold">{money(taskAmount(t, workers))}</span>
                      </div>
                      {next && w && <Button className="mt-2 w-full" onClick={() => patch(t.id, { status: next })}>{nextLabel[t.status]}</Button>}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Payouts() {
  const { workers, tasks, payments } = useStaff();
  const addPayment = useStaff((s) => s.addPayment);
  const vendors = useSupply((s) => s.vendors);
  const canPay = ["owner", "accountant"].includes(useCurrentUser().role);
  const [pay, setPay] = React.useState<{ worker?: Worker; contractorId?: string; kind: "advance" | "payout"; max: number } | null>(null);
  const { needsOwner, limit } = useAccess();
  const [amount, setAmount] = React.useState(0);
  const [mode, setMode] = React.useState<PaymentMode>("cash");
  const rows = workers.filter((w) => w.type !== "salaried").map((w) => ({ w, b: workerBalance(w.id, tasks, payments, workers) })).filter((r) => r.b.earned || r.b.advance || r.b.paid);
  // Contractor workers are settled through their contractor, not one by one.
  const contractors = [...new Set(workers.filter((w) => w.type === "contractor" && w.contractorId).map((w) => w.contractorId!))].map((id) => {
    const earned = rows.filter((r) => r.w.contractorId === id).reduce((s, r) => s + r.b.earned, 0);
    const paid = payments.filter((p) => p.contractorId === id).reduce((s, p) => s + p.amount, 0);
    return { id, name: vendors.find((v) => v.id === id)?.name ?? "Contractor", earned, paid, balance: earned - paid };
  });
  const open = (p: NonNullable<typeof pay>) => { setAmount(Math.max(0, Math.round(p.max))); setPay(p); };
  if (rows.length === 0) return <EmptyState icon={Wallet} title="Nothing to pay yet" help="Workers appear here once their tasks are marked Done or Verified, or when you give an advance." />;
  return (
    <>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-muted text-left text-xs text-text-muted"><tr><th className="px-4 py-3 font-medium">Worker</th><th className="px-4 py-3 text-right font-medium">Tasks done</th><th className="px-4 py-3 text-right font-medium">Earned</th><th className="px-4 py-3 text-right font-medium">Advance</th><th className="px-4 py-3 text-right font-medium">Paid</th><th className="px-4 py-3 text-right font-medium">Balance</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="tnum divide-y">
            {rows.map(({ w, b }) => (
              <tr key={w.id}>
                <td className="px-4 py-2.5"><span className="font-medium">{w.name}</span><span className="block text-xs text-text-muted">{w.role} · {typeLabel[w.type]}</span></td>
                <td className="px-4 py-2.5 text-right">{b.tasks}</td><td className="px-4 py-2.5 text-right">{money(b.earned)}</td><td className="px-4 py-2.5 text-right">{money(b.advance)}</td><td className="px-4 py-2.5 text-right">{money(b.paid)}</td>
                <td className={cn("px-4 py-2.5 text-right font-semibold", b.balance > 0 && "text-warning")}>{w.type === "contractor" && w.contractorId ? "Via contractor" : money(b.balance)}</td>
                <td className="px-4 py-2 text-right">{canPay && !(w.type === "contractor" && w.contractorId) && <span className="flex justify-end gap-1"><Button variant="ghost" onClick={() => open({ worker: w, kind: "advance", max: 0 })}>Advance</Button>{b.balance > 0 && <Button onClick={() => open({ worker: w, kind: "payout", max: b.balance })}>Pay</Button>}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {contractors.length > 0 && (
        <Card className="mt-4 divide-y">
          {contractors.map((c) => (
            <div key={c.id} className="tnum flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span><span className="font-medium">{c.name}</span><span className="block text-xs text-text-muted">Labour contractor · earned {money(c.earned)} · paid {money(c.paid)}</span></span>
              <span className="flex items-center gap-3"><span className={cn("font-semibold", c.balance > 0 && "text-warning")}>{money(c.balance)} due</span>{canPay && c.balance > 0 && <Button onClick={() => open({ contractorId: c.id, kind: "payout", max: c.balance })}>Pay contractor</Button>}</span>
            </div>
          ))}
        </Card>
      )}
      <Modal
        open={!!pay}
        onOpenChange={(o) => !o && setPay(null)}
        title={pay?.kind === "advance" ? `Advance to ${pay.worker?.name}` : `Pay ${pay?.worker?.name ?? "contractor"}`}
        description={needsOwner("payout", amount) ? `Above ${money(limit("payout"))}, only the owner can record this payment.` : pay?.kind === "advance" ? "Taken off the next payout." : "Recorded against finished tasks."}
        footer={<><Button variant="ghost" onClick={() => setPay(null)}>Cancel</Button><Button variant="primary" disabled={amount <= 0 || needsOwner("payout", amount)} onClick={() => { if (!pay) return; addPayment({ workerId: pay.worker?.id, contractorId: pay.contractorId, kind: pay.kind, amount, mode, note: "" }); toast.success(`${money(amount)} recorded`); setPay(null); }}>Save</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount"><MoneyInput autoFocus value={amount} onChange={setAmount} /></Field>
          <Field label="Mode"><Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>{paymentModes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
        </div>
      </Modal>
    </>
  );
}

function Payroll() {
  const { workers, leaves, slips } = useStaff();
  const saveSlip = useStaff((s) => s.saveSlip);
  const tenantName = useStore((s) => s.tenant.name);
  const canPay = ["owner", "accountant"].includes(useCurrentUser().role);
  const [month, setMonth] = React.useState(isoDate(new Date()).slice(0, 7));
  const [edits, setEdits] = React.useState<Record<string, Partial<SalarySlip>>>({});
  const [view, setView] = React.useState<string | null>(null);
  const salaried = workers.filter((w) => w.type === "salaried" && w.active);
  const rowFor = (w: Worker) => {
    const saved = slips.find((s) => s.workerId === w.id && s.month === month);
    const mine = leaves.filter((l) => l.workerId === w.id && l.date.startsWith(month));
    const base = { workerId: w.id, month, base: w.monthlySalary, unpaidDays: mine.filter((l) => !l.paid).length, allowance: 0, bonus: 0, deduction: 0, advanceRecovery: 0 };
    const slip = { ...base, ...saved, ...(saved?.paidOn ? {} : { base: w.monthlySalary, unpaidDays: base.unpaidDays }), ...edits[w.id] };
    return { slip, saved, paidLeave: mine.filter((l) => l.paid).length, net: netSalary(slip) };
  };
  const edit = (id: string, key: keyof SalarySlip, v: number) => setEdits((e) => ({ ...e, [id]: { ...e[id], [key]: v } }));
  const viewing = salaried.find((w) => w.id === view);
  if (salaried.length === 0) return <EmptyState icon={CalendarOff} title="No salaried staff" help="Set a worker's type to Salaried and enter their monthly salary to run payroll for them." />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3"><Field label="Month"><Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setEdits({}); }} /></Field><p className="tnum mt-4 text-sm text-text-muted">Total net {money(salaried.reduce((s, w) => s + rowFor(w).net, 0))}</p></div>
      <Card className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface-muted text-left text-xs text-text-muted"><tr><th className="px-4 py-3 font-medium">Staff</th><th className="px-2 py-3 text-right font-medium">Salary</th><th className="px-2 py-3 text-right font-medium">Leave</th>{["Allowance", "Bonus", "Deduction", "Advance recovery"].map((h) => <th key={h} className="w-24 px-2 py-3 text-right font-medium">{h}</th>)}<th className="px-2 py-3 text-right font-medium">Net</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="tnum divide-y">
            {salaried.map((w) => {
              const { slip, saved, paidLeave, net } = rowFor(w);
              const paid = !!saved?.paidOn;
              return (
                <tr key={w.id}>
                  <td className="px-4 py-2"><span className="font-medium">{w.name}</span><span className="block text-xs text-text-muted">{w.role}</span></td>
                  <td className="px-2 py-2 text-right">{money(slip.base)}</td>
                  <td className="px-2 py-2 text-right text-xs">{paidLeave} paid<span className={cn("block", slip.unpaidDays > 0 && "text-warning")}>{slip.unpaidDays} unpaid</span></td>
                  {(["allowance", "bonus", "deduction", "advanceRecovery"] as const).map((k) => <td key={k} className="px-2 py-1">{paid ? <span className="block text-right">{money(slip[k])}</span> : <Num aria-label={`${k} for ${w.name}`} value={slip[k]} onChange={(v) => edit(w.id, k, v)} />}</td>)}
                  <td className="px-2 py-2 text-right font-heading text-base font-bold">{money(net)}</td>
                  <td className="px-4 py-2"><span className="flex items-center justify-end gap-1">{paid ? <Badge tone="success">Paid {fmtDate(saved!.paidOn!, { day: "numeric", month: "short" })}</Badge> : canPay && <Button onClick={() => { saveSlip(slip, "bank"); toast.success(`${money(net)} salary paid to ${w.name}`); }}>Pay</Button>}<Button variant="ghost" onClick={() => { if (!paid) saveSlip(slip); setView(w.id); }}>Slip</Button></span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-text-muted">Unpaid leave is cut at one thirtieth of the salary per day. Mark leave on the worker&apos;s card.</p>
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setView(null)} title="Salary slip" footer={<Button onClick={printLight}><Printer strokeWidth={1.75} />Print</Button>}>
        {viewing && (() => { const { slip, net, paidLeave, saved } = rowFor(viewing); return (
          <article className="tnum text-sm">
            <header className="border-b-2 border-text pb-2"><p className="font-heading text-lg font-bold">{tenantName}</p><p className="text-xs text-text-muted">Salary slip · {new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p></header>
            <p className="mt-3 font-medium">{viewing.name}<span className="block text-xs font-normal text-text-muted">{viewing.role}{viewing.phone ? ` · ${viewing.phone}` : ""}</span></p>
            <dl className="mt-3 space-y-1.5">
              {[["Monthly salary", slip.base], [`Unpaid leave (${slip.unpaidDays} days)`, -Math.round((slip.base / 30) * slip.unpaidDays)], ["Allowance", slip.allowance], ["Bonus", slip.bonus], ["Deduction", -slip.deduction], ["Advance recovery", -slip.advanceRecovery]].filter(([, v], i) => i === 0 || v !== 0).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-text-muted">{k}</dt><dd>{Number(v) < 0 ? "-" : ""}{money(Math.abs(Number(v)))}</dd></div>)}
              <div className="flex items-baseline justify-between border-t pt-2"><dt className="font-medium">Net pay</dt><dd className="font-heading text-xl font-bold">{money(net)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-text-muted">{paidLeave} paid leave days. {saved?.paidOn ? `Paid on ${fmtDate(saved.paidOn)}.` : "Not paid yet."}</p>
          </article>
        ); })()}
      </Sheet>
    </>
  );
}

export default function StaffPage() {
  const open = useStaff((s) => s.tasks.filter((t) => t.status !== "done" && t.status !== "verified").length);
  return (
    <>
      <PageHeader title="Staff and Tasks" subtitle="Who is doing what on each event, what it costs, and what you owe them." />
      <StaffGate>
        <Tabs defaultValue="workers">
          <TabsList>
            <TabsTrigger value="workers"><Users className="size-5" strokeWidth={1.75} />Workers</TabsTrigger>
            <TabsTrigger value="board"><ListChecks className="size-5" strokeWidth={1.75} />Task board{open > 0 && <span className="tnum rounded-full bg-surface-muted px-1.5 text-xs">{open}</span>}</TabsTrigger>
            <TabsTrigger value="payouts"><Wallet className="size-5" strokeWidth={1.75} />Payouts</TabsTrigger>
            <TabsTrigger value="payroll"><CalendarOff className="size-5" strokeWidth={1.75} />Payroll</TabsTrigger>
          </TabsList>
          <TabsContent value="workers"><Workers /></TabsContent>
          <TabsContent value="board"><Board /></TabsContent>
          <TabsContent value="payouts"><Payouts /></TabsContent>
          <TabsContent value="payroll"><Payroll /></TabsContent>
        </Tabs>
      </StaffGate>
    </>
  );
}
