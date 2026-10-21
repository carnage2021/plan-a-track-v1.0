"use client";

import { Copy, Eye, EyeOff, KeyRound, MessageCircle, Plus, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/sheet";
import { usePlan } from "@/lib/platform";
import { useCurrentUser, useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import type { Role, TeamUser } from "@/lib/types";
import { whatsappLink } from "@/lib/utils";

const staffRoles: Role[] = ["sales", "operations", "kitchen", "store", "accountant"];

async function teamApi(method: "GET" | "POST", body?: object) {
  const { data } = await supabase().auth.getSession();
  const res = await fetch("/api/team", { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "That did not work.");
  return json;
}

/** Easy to read out over the phone: no 0/O or 1/l, and long enough to be safe. */
function newPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("").replace(/^(.{5})/, "$1-");
}
const suggestId = (name: string, business: string) => {
  const first = name.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z0-9]/g, "") ?? "";
  const biz = business.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
  return first ? `${first}.${biz}` : "";
};

function Credentials({ name, phone, loginId, password, onClose }: { name: string; phone: string; loginId: string; password: string; onClose: () => void }) {
  const business = useStore((s) => s.tenant.name);
  const text = `Namaste ${name}, your login for ${business}:\nLogin ID: ${loginId}\nPassword: ${password}\nOpen ${typeof window === "undefined" ? "" : window.location.origin}/login to sign in.`;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Login ready for ${name}`} description="Share these with them. The password is not shown again; you can reset it any time." footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <dl className="tnum space-y-2 rounded-xl bg-surface-muted p-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-text-muted">Login ID</dt><dd className="font-mono font-semibold">{loginId}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-text-muted">Password</dt><dd className="font-mono font-semibold">{password}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copied"))}><Copy strokeWidth={1.75} />Copy</Button>
        {phone && <Button variant="ghost" asChild><a href={whatsappLink(phone, text)} target="_blank" rel="noreferrer"><MessageCircle strokeWidth={1.75} />Send on WhatsApp</a></Button>}
      </div>
    </Modal>
  );
}

/** The owner creates each team member's login ID and password, and can reset or remove it later. */
export function TeamForm() {
  const tr = useTranslations("roles");
  const me = useCurrentUser();
  const users = useStore((s) => s.users);
  const business = useStore((s) => s.tenant.name);
  const reload = useStore((s) => s.reload);
  const removeInvite = useStore((s) => s.removeUser);
  const { seats } = usePlan();
  const [logins, setLogins] = React.useState<Record<string, string>>({});
  const [memberBranch, setMemberBranch] = React.useState<Record<string, string>>({});
  const branches = useStore((s) => s.branches);
  const [form, setForm] = React.useState({ name: "", phone: "", role: "kitchen" as Role, loginId: "", password: newPassword(), inviteId: "" });
  const [show, setShow] = React.useState(true);
  const [busy, setBusy] = React.useState("");
  const [shared, setShared] = React.useState<{ name: string; phone: string; loginId: string; password: string } | null>(null);
  const [reset, setReset] = React.useState<TeamUser | null>(null);
  const [resetPw, setResetPw] = React.useState("");
  const [removing, setRemoving] = React.useState<TeamUser | null>(null);
  const isOwner = me.role === "owner";
  const members = users.filter((u) => !u.invited);
  const invites = users.filter((u) => u.invited);

  const loadLogins = React.useCallback(() => {
    teamApi("GET").then((r) => { setLogins(r.logins); setMemberBranch(r.branches ?? {}); }, () => undefined);
  }, []);
  React.useEffect(() => {
    if (isOwner) loadLogins();
  }, [isOwner, loadLogins]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const onName = (name: string) => set({ name, loginId: !form.loginId || form.loginId === suggestId(form.name, business) ? suggestId(name, business) : form.loginId });
  const full = seats !== undefined && members.length >= seats;

  const run = async (key: string, body: object, done: string) => {
    setBusy(key);
    try {
      await teamApi("POST", body);
      toast.success(done);
      await reload();
      loadLogins();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work.");
      return false;
    } finally {
      setBusy("");
    }
  };
  const create = async () => {
    const ok = await run("create", { action: "create", ...form, suffix: business.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) }, `${form.name.trim()} can now sign in`);
    if (!ok) return;
    setShared({ name: form.name.trim(), phone: form.phone, loginId: form.loginId, password: form.password });
    setForm({ name: "", phone: "", role: "kitchen", loginId: "", password: newPassword(), inviteId: "" });
  };

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-xl border">
        {members.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
            <Avatar name={u.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name}{u.id === me.id && <span className="font-normal text-text-muted"> (you)</span>}</p>
              <p className="tnum truncate text-xs text-text-muted">{logins[u.id] ? <span className="font-mono">{logins[u.id]}</span> : tr(u.role)}{u.phone ? ` · ${u.phone}` : ""}</p>
            </div>
            {isOwner && u.role !== "owner" ? (
              <div className="flex items-center gap-1">
                {branches.length > 0 && <Select aria-label={`Branch of ${u.name}`} className="h-9 w-auto" value={memberBranch[u.id] ?? ""} onChange={(e) => void run(`branch-${u.id}`, { action: "set_branch", userId: u.id, branchId: e.target.value }, e.target.value ? `${u.name} now works at ${branches.find((b) => b.id === e.target.value)?.name}` : `${u.name} can see every branch`)}><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>}
                <Select aria-label={`Role of ${u.name}`} className="h-9 w-auto" value={u.role} onChange={(e) => void run(`role-${u.id}`, { action: "set_role", userId: u.id, role: e.target.value }, `${u.name} is now ${tr(e.target.value as Role)}`)}>{staffRoles.map((r) => <option key={r} value={r}>{tr(r)}</option>)}</Select>
                <Button variant="ghost" size="icon" aria-label={`Reset password for ${u.name}`} onClick={() => { setReset(u); setResetPw(newPassword()); }}><KeyRound strokeWidth={1.75} /></Button>
                <Button variant="ghost" size="icon" aria-label={`Remove ${u.name}`} onClick={() => setRemoving(u)}><Trash2 strokeWidth={1.75} /></Button>
              </div>
            ) : <span className="text-xs text-text-muted">{tr(u.role)}</span>}
          </li>
        ))}
        {invites.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 bg-surface-muted/40 p-3">
            <Avatar name={u.name} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.name}</p><p className="truncate text-xs text-text-muted">{tr(u.role)} · no login yet</p></div>
            {isOwner && <Button variant="ghost" onClick={() => setForm({ name: u.name, phone: u.phone, role: u.role === "owner" ? "sales" : u.role, loginId: suggestId(u.name, business), password: newPassword(), inviteId: u.id })}><UserPlus strokeWidth={1.75} />Create login</Button>}
            {isOwner && <Button variant="ghost" size="icon" aria-label={`Remove ${u.name}`} onClick={() => removeInvite(u.id)}><Trash2 strokeWidth={1.75} /></Button>}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="space-y-3 rounded-xl bg-surface-muted p-4">
          <p className="text-sm font-medium">{form.inviteId ? `Create a login for ${form.name}` : "Add a team member"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Name"><Input className="bg-surface" value={form.name} onChange={(e) => onName(e.target.value)} placeholder="Ramesh Patel" /></Field>
            <Field label="Mobile (for WhatsApp)"><Input className="bg-surface" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="98980 12345" /></Field>
            <Field label="Role"><Select className="bg-surface" value={form.role} onChange={(e) => set({ role: e.target.value as Role })}>{staffRoles.map((r) => <option key={r} value={r}>{tr(r)}</option>)}</Select></Field>
            <Field label="Login ID" hint="What they type to sign in"><Input className="bg-surface font-mono" autoCapitalize="none" spellCheck={false} value={form.loginId} onChange={(e) => set({ loginId: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") })} placeholder="ramesh.royal" /></Field>
            <Field label="Password" hint="At least 8 characters">
              <div className="flex gap-1">
                <Input className="bg-surface font-mono" type={show ? "text" : "password"} value={form.password} onChange={(e) => set({ password: e.target.value })} />
                <Button variant="ghost" size="icon-lg" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>{show ? <EyeOff strokeWidth={1.75} /> : <Eye strokeWidth={1.75} />}</Button>
                <Button variant="ghost" size="icon-lg" aria-label="New password" onClick={() => set({ password: newPassword() })}><RefreshCw strokeWidth={1.75} /></Button>
              </div>
            </Field>
            <div className="flex items-end"><Button variant="primary" className="w-full" loading={busy === "create"} disabled={!form.name.trim() || form.loginId.length < 3 || form.password.length < 8 || full} onClick={create}><Plus strokeWidth={1.75} />Create login</Button></div>
          </div>
          {full && <p className="text-sm text-warning">Your plan includes {seats} team members. Add extra users from Plan and billing.</p>}
        </div>
      )}

      {shared && <Credentials {...shared} onClose={() => setShared(null)} />}
      <Modal open={!!reset} onOpenChange={(o) => !o && setReset(null)} title={`New password for ${reset?.name}`} description="Their old password stops working at once." footer={<><Button variant="ghost" onClick={() => setReset(null)}>Cancel</Button><Button variant="primary" loading={busy === "reset"} disabled={resetPw.length < 8} onClick={async () => { const u = reset!; if (await run("reset", { action: "reset_password", userId: u.id, password: resetPw }, "Password changed")) { setReset(null); setShared({ name: u.name, phone: u.phone, loginId: logins[u.id] ?? "", password: resetPw }); } }}>Change password</Button></>}>
        <Input className="font-mono" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
      </Modal>
      <Modal open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title={`Remove ${removing?.name}?`} description="Their login stops working. Orders, tasks and payments they handled stay in the records." footer={<><Button variant="ghost" onClick={() => setRemoving(null)}>Keep</Button><Button variant="danger" loading={busy === "remove"} onClick={async () => { if (await run("remove", { action: "remove", userId: removing!.id }, `${removing!.name} removed`)) setRemoving(null); }}>Remove</Button></>}>{null}</Modal>
    </div>
  );
}
