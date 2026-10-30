"use client";

import { AlertTriangle, CheckCheck, ChefHat, DatabaseZap, LogIn, Plus, Trash2, UserPlus, Users } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState, ServiceLabel } from "@/components/shared/blocks";
import { Num } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { clashFor, defaultRate, sampleWorkers, statusFlow, statusLabel, suggestedHeadcount, taskAmount, useStaff, workerRoles, type Task, type TaskStatus } from "@/lib/staff";
import { useStore } from "@/lib/store";
import type { EventFunction, Order } from "@/lib/types";
import { cn, fmtDate, money, num } from "@/lib/utils";

const tone: Record<TaskStatus, "neutral" | "info" | "primary" | "success"> = { assigned: "neutral", accepted: "info", in_progress: "primary", done: "success", verified: "success" };
export function TaskBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={tone[status]}>{status === "verified" ? <CheckCheck strokeWidth={2} /> : <span className="size-1.5 rounded-full bg-current" aria-hidden />}{statusLabel[status]}</Badge>;
}
export const nextStatus = (s: TaskStatus) => statusFlow[statusFlow.indexOf(s) + 1];
export const nextLabel: Partial<Record<TaskStatus, string>> = { assigned: "Accepted", accepted: "Start", in_progress: "Done", done: "Verify" };

/** Explains what is pending, or offers a sample crew, before the staff screens can be used. */
export function StaffGate({ children }: { children: React.ReactNode }) {
  const ready = useStaff((s) => s.ready);
  const none = useStaff((s) => s.workers.length === 0);
  const saveWorker = useStaff((s) => s.saveWorker);
  const [byHand, setByHand] = React.useState(false);
  if (!ready) return <EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0004_staff.sql in the Supabase SQL editor, then reload this page. It creates the tables for workers, tasks and payroll." />;
  if (none && !byHand)
    return (
      <EmptyState
        icon={Users}
        title="No workers yet"
        help="Add your cooks, helpers, waiters, bais and drivers. Or start with a sample crew of twelve to try the screens, and edit or remove them later."
        action={<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => { sampleWorkers.forEach(saveWorker); toast.success("Sample crew added"); }}><UserPlus strokeWidth={1.75} />Add a sample crew</Button><Button variant="ghost" onClick={() => setByHand(true)}>Add workers by hand</Button></div>}
      />
    );
  return <>{children}</>;
}

function TaskRow({ task, fn, order }: { task: Task; fn: EventFunction; order: Order }) {
  const { workers, tasks, leaves } = useStaff();
  const patch = useStaff((s) => s.patchTask);
  const remove = useStaff((s) => s.removeTask);
  const worker = workers.find((w) => w.id === task.workerId);
  const clash = task.workerId ? clashFor(task.workerId, fn, order.id, tasks, leaves) : "";
  const pool = workers.filter((w) => w.active);
  const sameRole = pool.filter((w) => w.role === task.role);
  const others = pool.filter((w) => w.role !== task.role);
  const next = nextStatus(task.status);
  const assign = (id: string) => {
    const w = workers.find((x) => x.id === id);
    // The price follows the worker's rate card unless one was already typed in.
    patch(task.id, { workerId: id || undefined, rate: w && (!task.rate || task.rate === defaultRate(worker)) ? defaultRate(w) : task.rate });
  };
  return (
    <li className="grid grid-cols-2 items-center gap-2 py-2.5 md:grid-cols-[1.2fr_1.4fr_auto_auto_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{task.itemId && <ChefHat className="mr-1 inline size-4 text-accent-gold" strokeWidth={1.75} />}{task.title}</p>
        <p className="truncate text-xs text-text-muted">{task.role}{task.checkedInAt ? ` · checked in ${new Date(task.checkedInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}</p>
      </div>
      <div className="min-w-0">
        <Select aria-label={`Worker for ${task.title}`} value={task.workerId ?? ""} onChange={(e) => assign(e.target.value)} className={cn(!task.workerId && "border-warning")}>
          <option value="">Not assigned</option>
          {sameRole.length > 0 && <optgroup label={task.role}>{sameRole.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</optgroup>}
          <optgroup label="Others">{others.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.role}</option>)}</optgroup>
        </Select>
        {clash && <p className="mt-0.5 flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.75} />{clash}</p>}
      </div>
      <div className="tnum flex items-center gap-1 text-xs text-text-muted">
        <Num aria-label="Quantity" className="w-14" value={task.qty} onChange={(v) => patch(task.id, { qty: v || 1 })} />×
        <Num aria-label="Rate" className="w-20" value={task.rate} onChange={(v) => patch(task.id, { rate: v })} />
        {(task.status === "in_progress" || task.status === "done") && <><span className="pl-1">OT h</span><Num aria-label="Overtime hours" className="w-14" value={task.overtimeHours} onChange={(v) => patch(task.id, { overtimeHours: v })} /></>}
      </div>
      <p className="tnum text-right text-sm font-semibold">{money(taskAmount(task, workers))}</p>
      <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1">
        <TaskBadge status={task.status} />
        {task.workerId && !task.checkedInAt && task.status !== "verified" && <Button size="icon" variant="ghost" title="Check in at venue" aria-label="Check in at venue" onClick={() => patch(task.id, { checkedInAt: new Date().toISOString(), status: task.status === "assigned" || task.status === "accepted" ? "in_progress" : task.status })}><LogIn strokeWidth={1.75} /></Button>}
        {next && task.workerId && <Button onClick={() => patch(task.id, { status: next })}>{nextLabel[task.status]}</Button>}
        <Button size="icon" variant="ghost" aria-label={`Remove ${task.title}`} onClick={() => { remove(task.id); toast("Task removed", { action: { label: "Undo", onClick: () => useStaff.getState().addTasks([task]) } }); }}><Trash2 strokeWidth={1.75} /></Button>
      </div>
    </li>
  );
}

function FunctionTasks({ fn, order }: { fn: EventFunction; order: Order }) {
  const { workers, tasks } = useStaff();
  const addTasks = useStaff((s) => s.addTasks);
  const items = useStore((s) => s.items);
  const mine = tasks.filter((t) => t.functionId === fn.id);
  const [plan, setPlan] = React.useState<ReturnType<typeof suggestedHeadcount> | null>(null);
  const [title, setTitle] = React.useState("");
  const [role, setRole] = React.useState(workerRoles[0]);
  const [dish, setDish] = React.useState("");
  const cost = mine.reduce((s, t) => s + taskAmount(t, workers), 0);
  const unassigned = mine.filter((t) => !t.workerId).length;
  const blank = (t: Pick<Task, "title" | "role"> & Partial<Task>): Omit<Task, "id"> => ({ orderId: order.id, functionId: fn.id, startTime: "", dueTime: fn.time, priority: "normal", status: "assigned", qty: 1, rate: 0, overtimeHours: 0, notes: "", ...t });
  // A line's starting rate is what workers of that role usually charge per event.
  const typical = (r: string) => { const rates = workers.filter((w) => w.role === r && defaultRate(w) > 0).map(defaultRate).sort((a, b) => a - b); return rates[Math.floor(rates.length / 2)] ?? 0; };
  const create = () => {
    if (!plan) return;
    addTasks(plan.flatMap((p) => Array.from({ length: p.count }, (_, i) => blank({ title: p.count > 1 ? `${p.title} ${i + 1}` : p.title, role: p.role, rate: typical(p.role) }))));
    toast.success(`${plan.reduce((s, p) => s + p.count, 0)} tasks created for ${fn.name}`);
    setPlan(null);
  };
  const dishes = items.filter((i) => fn.itemIds.includes(i.id) && !i.outsourced && !mine.some((t) => t.itemId === i.id));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-heading text-base font-semibold">{fn.name}</h3><p className="tnum text-xs text-text-muted">{fmtDate(fn.date, { weekday: "short", day: "numeric", month: "short" })}, <ServiceLabel fn={fn} /> · {num(fn.pax)} guests</p></div>
        <p className="tnum text-right text-sm"><span className="font-heading text-lg font-bold">{money(cost)}</span><span className="block text-xs text-text-muted">{mine.length} tasks{unassigned ? ` · ${unassigned} not assigned` : ""}</span></p>
      </div>

      {mine.length === 0 && !plan && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3">
          <p className="text-sm text-text-muted">No tasks yet. Start from the suggested crew for {num(fn.pax)} guests.</p>
          <Button onClick={() => setPlan(suggestedHeadcount(fn.pax))}><Users strokeWidth={1.75} />Plan the crew</Button>
        </div>
      )}
      {plan && (
        <div className="mt-3 rounded-xl bg-surface-muted p-3">
          <p className="text-xs font-medium text-text-muted">Suggested headcount for {num(fn.pax)} guests. Change any number before creating.</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {plan.map((p, i) => <label key={p.role} className="text-xs text-text-muted">{p.title}<Num aria-label={p.title} className="mt-1 bg-surface text-left" value={p.count} onChange={(v) => setPlan(plan.map((x, j) => (j === i ? { ...x, count: Math.max(0, Math.round(v)) } : x)))} /></label>)}
          </div>
          <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => setPlan(null)}>Cancel</Button><Button variant="primary" onClick={create}>Create {plan.reduce((s, p) => s + p.count, 0)} tasks</Button></div>
        </div>
      )}

      {mine.length > 0 && (
        <>
          <ul className="mt-2 divide-y">{mine.map((t) => <TaskRow key={t.id} task={t} fn={fn} order={order} />)}</ul>
          <div className="mt-2 grid grid-cols-1 gap-2 border-t pt-3 md:grid-cols-[1fr_auto_auto_1fr_auto]">
            <Input aria-label="New task" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task, e.g. Roti making" />
            <Select creatable aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="md:w-36">{workerRoles.map((r) => <option key={r}>{r}</option>)}</Select>
            <Button disabled={!title.trim()} onClick={() => { addTasks([blank({ title: title.trim(), role, rate: typical(role) })]); setTitle(""); }}><Plus strokeWidth={1.75} />Add</Button>
            <Select aria-label="Assign a chef to a dish" value={dish} onChange={(e) => setDish(e.target.value)}><option value="">Assign a chef to one dish</option>{dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            <Button disabled={!dish} onClick={() => { addTasks([blank({ title: `Chef: ${items.find((i) => i.id === dish)?.name}`, role: "Cook", itemId: dish, rate: typical("Cook") })]); setDish(""); }}><ChefHat strokeWidth={1.75} />Add</Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** Staff and Tasks tab of an order: the crew for each function, what each task costs, and attendance. */
export function OrderTasks({ order }: { order: Order }) {
  const { workers, tasks } = useStaff();
  const mine = tasks.filter((t) => t.orderId === order.id);
  const cost = mine.reduce((s, t) => s + taskAmount(t, workers), 0);
  const functions = [...order.functions].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return (
    <div className="space-y-3">
      {mine.length > 0 && <p className="tnum text-sm text-text-muted">Labour for this order: <span className="font-semibold text-text">{money(cost)}</span> across {mine.length} tasks, {mine.filter((t) => t.status === "done" || t.status === "verified").length} finished.</p>}
      {functions.map((fn) => <FunctionTasks key={fn.id} fn={fn} order={order} />)}
    </div>
  );
}
