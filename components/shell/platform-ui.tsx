"use client";

import { CheckCircle2, Clock, LifeBuoy, Lock, LogOut, Megaphone, Printer, Sparkles, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { eventsThisMonth, usePlan, usePlatform, type Plan, type SubInvoice } from "@/lib/platform";
import { useStore } from "@/lib/store";
import { printLight } from "@/lib/ui";
import { cn, fmtDate, money, localDay } from "@/lib/utils";

const planPrice = (p: Plan) => `${money(p.monthlyPrice)} a month, or ${money(p.firstYearPrice ?? p.annualPrice)} for the first year`;

/** Trial countdown, overdue warning and the platform's announcements, above every page. */
export function PlatformBanner() {
  const { sub, trialLeft } = usePlan();
  const announcements = usePlatform((s) => s.announcements);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const bars: { id: string; tone: "info" | "warning" | "success"; text: React.ReactNode }[] = [];
  if (sub?.status === "trial" && trialLeft !== undefined && trialLeft >= 0) bars.push({ id: "trial", tone: trialLeft <= 3 ? "warning" : "info", text: <>{trialLeft === 0 ? "Your free trial ends today." : `${trialLeft} ${trialLeft === 1 ? "day" : "days"} left in your free trial.`} <Link href="/settings?tab=plan" className="font-semibold underline">Choose a plan</Link></> });
  if (sub?.status === "overdue") bars.push({ id: "overdue", tone: "warning", text: <>Your subscription payment is overdue. Please pay to keep the account running. <Link href="/settings?tab=plan" className="font-semibold underline">Plan and billing</Link></> });
  for (const a of announcements) bars.push({ id: a.id, tone: a.tone, text: a.message });
  const shown = bars.filter((b) => !hidden.includes(b.id));
  if (!shown.length) return null;
  return (
    <div className="space-y-2 px-4 pt-3 md:px-6">
      {shown.map((b) => (
        <p key={b.id} role="status" className={cn("flex items-start gap-2 rounded-xl px-3 py-2 text-sm", b.tone === "warning" ? "bg-warning/10 text-warning" : b.tone === "success" ? "bg-success/10 text-success" : "bg-info/10 text-info")}>
          {b.id === "trial" ? <Clock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} /> : <Megaphone className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />}
          <span className="flex-1">{b.text}</span>
          <button type="button" aria-label="Hide" onClick={() => setHidden([...hidden, b.id])} className="opacity-70 hover:opacity-100"><X className="size-4" strokeWidth={1.75} /></button>
        </p>
      ))}
    </div>
  );
}

function UpgradeRequest({ plan, onDone }: { plan?: Plan; onDone?: () => void }) {
  const raiseTicket = usePlatform((s) => s.raiseTicket);
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant="primary" loading={busy} onClick={async () => {
      setBusy(true);
      try {
        await raiseTicket(plan ? `Upgrade to ${plan.name}` : "Reactivate my account", plan ? `Please move us to the ${plan.name} plan (${planPrice(plan)}).` : "Please reactivate our account.");
        toast.success("Request sent", { description: "Our team will call you to set it up. You can follow it under Help and support." });
        onDone?.();
      } catch (e) {
        toast.error("The request was not sent", { description: e instanceof Error ? e.message : undefined });
      } finally {
        setBusy(false);
      }
    }}>{plan ? `Choose ${plan.name}` : "Ask us to reactivate"}</Button>
  );
}

/** Stops work when the account is paused or the trial has run out, and offers the plans or reactivation instead. */
export function PlatformGate({ children }: { children: React.ReactNode }) {
  const { blocked } = usePlan();
  const plans = usePlatform((s) => s.plans).filter((p) => p.active);
  const signOut = useStore((s) => s.signOut);
  const name = useStore((s) => s.tenant.name);
  if (!blocked) return <>{children}</>;
  return (
    <div className="mx-auto max-w-3xl py-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-warning/10 text-warning"><Lock className="size-7" strokeWidth={1.75} /></span>
      <h1 className="mt-4 font-heading text-2xl font-bold">{blocked === "suspended" ? `${name} is paused` : "Your free trial has ended"}</h1>
      <p className="mx-auto mt-2 max-w-lg text-text-muted">{blocked === "suspended" ? "The account has been paused, usually for an unpaid subscription. Your data is safe and comes back the moment it is reactivated." : "Thank you for trying us. Choose a plan to carry on; all your menus, orders and clients are kept exactly as they are."}</p>
      {blocked === "trial_over" && (
        <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="flex flex-col p-4">
              <p className="font-heading text-lg font-semibold">{p.name}</p>
              <p className="tnum mt-1 text-2xl font-bold">{money(p.monthlyPrice)}<span className="text-sm font-normal text-text-muted"> a month</span></p>
              <ul className="mt-2 flex-1 space-y-1 text-sm text-text-muted"><li>{p.includedUsers} team members</li><li>{p.eventsPerMonth ? `${p.eventsPerMonth} bookings a month` : "Unlimited bookings"}</li><li>{p.branches} {p.branches === 1 ? "branch" : "branches"}</li></ul>
              <div className="mt-3"><UpgradeRequest plan={p} /></div>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {blocked === "suspended" && <UpgradeRequest />}
        <Button variant="ghost" onClick={() => void signOut()}><LogOut strokeWidth={1.75} />Sign out</Button>
      </div>
    </div>
  );
}

export function HelpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { tickets, raiseTicket } = usePlatform();
  const ready = usePlatform((s) => s.ready);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await raiseTicket(subject.trim(), body.trim());
      toast.success("Sent to our support team", { description: "The reply shows here." });
      setSubject("");
      setBody("");
    } catch (e) {
      toast.error("Not sent", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Help and support" description="Write to the team behind the software. Replies arrive here.">
      {!ready ? <p className="text-sm text-text-muted">Support opens once the platform update (0010_platform.sql) is in place.</p> : (
        <div className="space-y-5">
          <div className="space-y-3">
            <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Cannot print the GST invoice" /></Field>
            <Field label="What happened"><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
            <Button variant="primary" loading={busy} disabled={!subject.trim() || !body.trim()} onClick={send}><LifeBuoy strokeWidth={1.75} />Send</Button>
          </div>
          {tickets.length > 0 && (
            <ul className="divide-y rounded-xl border">
              {tickets.map((t) => (
                <li key={t.id} className="p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{t.subject}<Badge tone={t.status === "open" ? "warning" : t.status === "answered" ? "success" : "neutral"}>{t.status === "open" ? "Waiting" : t.status === "answered" ? "Answered" : "Closed"}</Badge></p>
                  <p className="mt-1 text-text-muted">{t.body}</p>
                  {t.reply && <p className="mt-2 rounded-lg bg-primary-soft p-2 text-text"><span className="font-medium">Reply: </span>{t.reply}</p>}
                  <p className="tnum mt-1 text-xs text-text-muted">{fmtDate(localDay(t.createdAt), { day: "numeric", month: "short" })}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function WhatsNewSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const changelog = usePlatform((s) => s.changelog);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="What's new" description="Recent improvements to the software.">
      {changelog.length === 0 ? <p className="text-sm text-text-muted">Nothing announced yet.</p> : (
        <ol className="space-y-4">
          {changelog.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Sparkles className="size-4" strokeWidth={1.75} /></span>
              <span><span className="block font-medium">{c.title}</span><span className="tnum block text-xs text-text-muted">{fmtDate(c.publishedOn)}</span><span className="mt-1 block whitespace-pre-line text-sm text-text-muted">{c.body}</span></span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}

function SubInvoiceDoc({ inv }: { inv: SubInvoice }) {
  const tenant = useStore((s) => s.tenant);
  return (
    <article className="rounded-xl border bg-surface p-6 text-sm print:border-0">
      <div className="flex justify-between gap-4 border-b-2 pb-3"><div><p className="font-heading text-lg font-bold">Tax invoice</p><p className="text-text-muted">Subscription to the catering software</p></div><p className="tnum text-right">{inv.number}<br />{inv.paidOn && fmtDate(inv.paidOn)}</p></div>
      <p className="mt-3"><span className="text-text-muted">Billed to: </span>{tenant.name}{tenant.gstin && `, GSTIN ${tenant.gstin}`}</p>
      <p className="mt-1 text-text-muted">{tenant.address}</p>
      <dl className="tnum mt-4 space-y-1.5">
        <div className="flex justify-between gap-3"><dt>{inv.description}<span className="block text-xs text-text-muted">{fmtDate(inv.periodStart)} to {fmtDate(inv.periodEnd)}</span></dt><dd>{money(inv.amount)}</dd></div>
        <div className="flex justify-between text-text-muted"><dt>GST 18%</dt><dd>{money(inv.gst)}</dd></div>
        <div className="flex justify-between border-t-2 pt-2 font-semibold"><dt>Total</dt><dd>{money(inv.total)}</dd></div>
      </dl>
      <p className="mt-4 flex items-center gap-1.5 text-success"><CheckCircle2 className="size-4" strokeWidth={1.75} />Paid</p>
    </article>
  );
}

/** Settings tab: the plan, what is used of it, and our invoices to the caterer. */
export function PlanBillingForm() {
  const { sub, plan, trialLeft, seats } = usePlan();
  const { ready, invoices } = usePlatform();
  const plans = usePlatform((s) => s.plans).filter((p) => p.active);
  const users = useStore((s) => s.users);
  const [doc, setDoc] = React.useState<SubInvoice | null>(null);
  if (!ready || !sub) return <p className="rounded-xl bg-warning/10 p-4 text-sm text-warning">Run supabase/migrations/0010_platform.sql in the Supabase SQL editor and reload to see your plan.</p>;
  const used = eventsThisMonth();
  const statusText = { trial: trialLeft !== undefined && trialLeft >= 0 ? `Free trial, ${trialLeft} ${trialLeft === 1 ? "day" : "days"} left` : "Trial ended", active: sub.paidUntil ? `Active, paid until ${fmtDate(sub.paidUntil)}` : "Active", overdue: "Payment overdue", suspended: "Paused" }[sub.status];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
        <div>
          <p className="text-xs text-text-muted">Your plan</p>
          <p className="font-heading text-2xl font-bold">{plan?.name ?? "Free trial"}</p>
          <p className="text-sm text-text-muted">{statusText}{plan && ` · billed ${sub.cycle === "annual" ? "yearly" : "monthly"}`}</p>
        </div>
        <Badge tone={sub.status === "active" ? "success" : sub.status === "trial" ? "info" : "warning"}>{sub.status === "trial" ? "Trial" : sub.status === "active" ? "Active" : sub.status === "overdue" ? "Overdue" : "Paused"}</Badge>
      </div>
      {plan && (
        <dl className="tnum grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-muted p-3"><dt className="text-xs text-text-muted">Bookings this month</dt><dd className="font-heading text-lg font-bold">{used}{plan.eventsPerMonth ? ` of ${plan.eventsPerMonth}` : ""}</dd></div>
          <div className="rounded-xl bg-surface-muted p-3"><dt className="text-xs text-text-muted">Team members</dt><dd className="font-heading text-lg font-bold">{users.length} of {seats}</dd></div>
          <div className="rounded-xl bg-surface-muted p-3"><dt className="text-xs text-text-muted">Add-ons</dt><dd className="text-sm font-medium">{plan.addons.filter((a) => sub.addons.includes(a.key)).map((a) => a.label).join(", ") || "None"}</dd></div>
        </dl>
      )}
      <div>
        <p className="text-sm font-medium">Plans</p>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className={cn("flex flex-col rounded-xl border p-4", p.id === plan?.id && "border-primary")}>
              <p className="flex items-center gap-2 font-medium">{p.name}{p.id === plan?.id && <Badge tone="primary">Current</Badge>}</p>
              <p className="tnum mt-1 text-xl font-bold">{money(p.monthlyPrice)}<span className="text-sm font-normal text-text-muted"> / month</span></p>
              <p className="tnum text-xs text-text-muted">{money(p.annualPrice)} a year{p.firstYearPrice != null && p.firstYearPrice !== p.annualPrice ? `, ${money(p.firstYearPrice)} the first year` : ""}</p>
              <ul className="mt-2 flex-1 space-y-0.5 text-sm text-text-muted"><li>{p.includedUsers} team members, then {money(p.extraUserPrice)} each</li><li>{p.eventsPerMonth ? `${p.eventsPerMonth} bookings a month` : "Unlimited bookings"}</li>{p.addons.map((a) => <li key={a.key}>{a.label}: +{money(a.price)} / month</li>)}</ul>
              {p.id !== plan?.id && <div className="mt-3"><UpgradeRequest plan={p} /></div>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-text-muted">Choosing a plan sends a request to our team, who confirm the change and the payment with you.</p>
      </div>
      <div>
        <p className="text-sm font-medium">Invoices</p>
        {invoices.length === 0 ? <p className="mt-1 text-sm text-text-muted">No subscription invoices yet.</p> : (
          <ul className="mt-2 divide-y rounded-xl border">
            {invoices.map((i) => <li key={i.id}><button type="button" onClick={() => setDoc(i)} className="tnum flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-surface-muted/60"><span><span className="block font-medium">{i.number}</span><span className="block text-xs text-text-muted">{fmtDate(i.periodStart)} to {fmtDate(i.periodEnd)}</span></span><span className="font-semibold">{money(i.total)}</span></button></li>)}
          </ul>
        )}
      </div>
      <Sheet open={!!doc} onOpenChange={(o) => !o && setDoc(null)} title={doc?.number ?? ""} footer={<Button onClick={printLight}><Printer strokeWidth={1.75} />Print or PDF</Button>}>{doc && <SubInvoiceDoc inv={doc} />}</Sheet>
    </div>
  );
}
