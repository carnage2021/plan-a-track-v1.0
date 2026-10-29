"use client";

import { Download, History, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton, ToggleRow } from "@/components/ui/primitives";
import type { TenantAccess } from "@/lib/access";
import { navItems } from "@/lib/nav";
import { useCurrentUser, useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";
import { cn, fmtDate, isoDate, localDay } from "@/lib/utils";

const staffRoles: Role[] = ["sales", "operations", "kitchen", "store", "accountant"];

function NeedsMigration() {
  return <p className="rounded-xl bg-warning/10 p-4 text-sm text-warning">Run supabase/migrations/0009_reports_messages_access.sql in the Supabase SQL editor and reload to use these settings.</p>;
}

/** What each role may open, price hiding, and the amounts above which the owner must step in. */
export function AccessForm() {
  const tn = useTranslations("nav");
  const tr = useTranslations("roles");
  const access = useStore((s) => s.tenant.access);
  const update = useStore((s) => s.updateTenant);
  if (!access) return <NeedsMigration />;
  const save = (next: TenantAccess) => update({ access: next });
  const setRole = (role: Role, patch: Partial<{ modules: string[]; hidePrices: boolean }> | null) => {
    const roles = { ...access.roles };
    const base = navItems.filter((n) => n.key !== "home" && n.key !== "settings" && (n.roles === "all" || n.roles.includes(role))).map((n) => n.key);
    if (patch === null) delete roles[role];
    else roles[role] = { modules: base, hidePrices: false, ...roles[role], ...patch };
    save({ ...access, roles });
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">What each role can open</p>
        <p className="text-xs text-text-muted">Untick a module to hide it from that role, in the menu and by direct link. The owner always sees everything.</p>
      </div>
      <div className="space-y-4">
        {staffRoles.map((role) => {
          const base = navItems.filter((n) => n.key !== "home" && n.key !== "settings" && (n.roles === "all" || n.roles.includes(role)));
          const custom = access.roles[role];
          const allowed = new Set(custom?.modules ?? base.map((n) => n.key));
          return (
            <div key={role} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">{tr(role)}{custom ? <Badge tone="primary">Customised</Badge> : <Badge>Default</Badge>}</p>
                {custom && <Button variant="ghost" onClick={() => { setRole(role, null); toast(`${tr(role)} back to default`); }}><RotateCcw strokeWidth={1.75} />Default</Button>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {base.map((n) => {
                  const on = allowed.has(n.key);
                  return (
                    <button key={n.key} type="button" aria-pressed={on} onClick={() => setRole(role, { modules: on ? [...allowed].filter((k) => k !== n.key) : [...allowed, n.key] })} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors", on ? "border-primary bg-primary-soft text-primary" : "bg-surface text-text-muted line-through")}>
                      <n.icon className="size-4" strokeWidth={1.75} />{tn(n.key)}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-t pt-3"><ToggleRow checked={!!custom?.hidePrices} onCheckedChange={(hidePrices) => setRole(role, { hidePrices })} label="Hide prices and margins" help="Dish prices, costs and margins disappear from the menu screens for this role." /></div>
            </div>
          );
        })}
      </div>
      <div>
        <p className="text-sm font-medium">Owner approval</p>
        <p className="text-xs text-text-muted">Above these amounts only the owner can go ahead. Leave at 0 for no limit. Discounts above the limit in Pricing rules already need approval.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Send purchase orders above"><MoneyInput value={access.poLimit} onChange={(poLimit) => save({ ...access, poLimit })} /></Field>
          <Field label="Pay workers or contractors above"><MoneyInput value={access.payoutLimit} onChange={(payoutLimit) => save({ ...access, payoutLimit })} /></Field>
        </div>
      </div>
      <p className="text-xs text-text-muted">These settings narrow what the app shows. What each role can change in the database is fixed by its role and cannot be widened here.</p>
    </div>
  );
}

const tableLabel: Record<string, string> = {
  clients: "Client", enquiries: "Enquiry", quotations: "Quotation", orders: "Order", event_functions: "Function", payments: "Payment", extra_charges: "Extra charge", menu_items: "Dish", packages: "Package",
  vendors: "Vendor", purchase_orders: "Purchase order", vendor_bills: "Vendor bill", vendor_payments: "Vendor payment", workers: "Worker", tasks: "Task", worker_payments: "Worker payment", invoices: "Invoice", credit_notes: "Credit note", expenses: "Expense", petty_cash: "Petty cash",
};
const verb = { insert: "added", update: "changed", delete: "removed" } as const;

interface Entry { id: number; table_name: string; action: keyof typeof verb; summary: string; actor: string | null; at: string }

/** Every change with who made it and when, from the database's own log. Only the owner can read it. */
export function ActivityForm() {
  const users = useStore((s) => s.users);
  const [rows, setRows] = React.useState<Entry[] | null>(null);
  const [error, setError] = React.useState(false);
  const [table, setTable] = React.useState("all");
  React.useEffect(() => {
    supabase().from("activity_log").select("id,table_name,action,summary,actor,at").order("at", { ascending: false }).limit(300).then(({ data, error: e }) => (e ? setError(true) : setRows(data as Entry[])));
  }, []);
  if (error) return <NeedsMigration />;
  if (!rows) return <Skeleton className="h-64" />;
  const shown = rows.filter((r) => table === "all" || r.table_name === table);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-medium">Activity log</p><p className="text-xs text-text-muted">The latest 300 changes. The database writes this itself, so nothing skips it.</p></div>
        <Field label="Show"><Select value={table} onChange={(e) => setTable(e.target.value)}><option value="all">Everything</option>{Object.entries(tableLabel).map(([k, v]) => <option key={k} value={k}>{v}s</option>)}</Select></Field>
      </div>
      {shown.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-text-muted">No changes recorded yet. They appear here from the moment the log was switched on.</p> : (
        <ul className="divide-y rounded-xl border">
          {shown.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <History className={cn("mt-0.5 size-4 shrink-0", r.action === "delete" ? "text-danger" : r.action === "insert" ? "text-success" : "text-text-muted")} strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block"><span className="font-medium">{users.find((u) => u.id === r.actor)?.name ?? (r.actor ? "A team member" : "System")}</span> {verb[r.action]} {(tableLabel[r.table_name] ?? r.table_name).toLowerCase()}{r.summary && <span className="font-medium"> {r.summary}</span>}</span>
              </span>
              <span className="tnum shrink-0 text-xs text-text-muted">{fmtDate(localDay(r.at), { day: "numeric", month: "short" })} {new Date(r.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const exportTables = [
  "tenants", "profiles", "team_invites", "clients", "enquiries", "quotations", "orders", "event_functions", "function_items", "extra_charges", "payments", "order_changes",
  "menu_categories", "menu_items", "packages", "package_rules", "recipe_lines", "ingredients", "stores", "stock_movements", "vendors", "vendor_rates", "purchase_orders", "po_lines", "vendor_bills", "vendor_payments",
  "outsource_orders", "outsource_lines", "assets", "challans", "challan_lines", "workers", "worker_leaves", "tasks", "worker_payments", "salary_slips", "kitchen_items", "vehicles", "trips", "onsite", "onsite_issues",
  "payment_milestones", "invoices", "credit_notes", "expenses", "petty_cash", "message_templates", "messages",
];

/** One file with everything this caterer has stored, for their own records or to move elsewhere. */
/**
 * Clears the business's records (clients, bookings, payments, menu, stock, staff ...) for a fresh start. The account,
 * settings, team logins and numbering stay. Owner only, and only after typing DELETE.
 */
function DeleteAllData({ onDownload, downloading }: { onDownload: () => void; downloading: boolean }) {
  const isOwner = useCurrentUser().role === "owner";
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!isOwner) return null;
  const run = async () => {
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      const res = await fetch("/api/reset-data", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Please try again.");
      toast.success("All data deleted", { description: "Your account, settings and team logins are kept. Reloading…" });
      // A full reload so every screen starts from the now empty account.
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error("The data was not deleted", { description: e instanceof Error ? e.message : undefined });
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
      <p className="text-sm font-medium text-danger">Delete all data</p>
      <p className="mt-1 text-xs text-text-muted">Removes every client, enquiry, quotation, booking, payment, invoice, dish, category, package, recipe, stock record, vendor, worker and expense. Your account, business settings, team logins, branches and event types stay. This cannot be undone, so download everything first.</p>
      {!open ? (
        <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}><Trash2 strokeWidth={1.75} />Delete all data</Button>
      ) : (
        <div className="mt-3 space-y-3">
          <Button onClick={onDownload} loading={downloading}><Download strokeWidth={1.75} />Download a copy first</Button>
          <Field label="Type DELETE to confirm">
            <Input aria-label="Type DELETE to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" autoComplete="off" className="max-w-48" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} disabled={typed.trim() !== "DELETE"} onClick={run}><Trash2 strokeWidth={1.75} />Delete everything now</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setTyped(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DataForm() {
  const name = useStore((s) => s.tenant.name);
  const [busy, setBusy] = React.useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const sb = supabase();
      const tables: Record<string, unknown[]> = {};
      const skipped: string[] = [];
      for (const t of exportTables) {
        const { data, error } = await sb.from(t).select("*").range(0, 99999);
        if (error) skipped.push(t);
        else tables[t] = data;
      }
      const blob = new Blob([JSON.stringify({ business: name, exportedAt: new Date().toISOString(), tables }, null, 1)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-data-${isoDate(new Date())}.json` });
      a.click();
      URL.revokeObjectURL(a.href);
      const rows = Object.values(tables).reduce((s, r) => s + r.length, 0);
      toast.success("Your data is downloaded", { description: `${rows.toLocaleString("en-IN")} records from ${Object.keys(tables).length} tables${skipped.length ? `; ${skipped.length} not set up yet` : ""}.` });
    } catch (e) {
      toast.error("The export did not finish", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Download all your data</p>
        <p className="text-xs text-text-muted">Clients, orders, payments, menu, recipes, stock, vendors, staff, invoices and the rest, in one JSON file. Photos stay in storage and are listed by their paths.</p>
        <Button variant="primary" className="mt-3" loading={busy} onClick={download}><Download strokeWidth={1.75} />Download everything</Button>
      </div>
      <DeleteAllData onDownload={download} downloading={busy} />
      <div className="rounded-xl bg-surface-muted p-4 text-sm">
        <p className="font-medium">Backups</p>
        <p className="mt-1 text-text-muted">The database is backed up daily by Supabase on paid plans, with point-in-time recovery as an add-on. On the free plan, download this file regularly as your own backup.</p>
      </div>
    </div>
  );
}

