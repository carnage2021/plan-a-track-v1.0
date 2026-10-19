"use client";

import { Check, Copy, ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { DocHeader, DocThemeContext, QrCode, docFrame, docStyle, docThemes } from "@/components/documents/theme";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ToggleRow } from "@/components/ui/primitives";
import { defaultDocs, mediaUrl } from "@/lib/db";
import { useStore } from "@/lib/store";
import type { DocSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

function NeedsMigration() {
  return <p className="rounded-xl bg-warning/10 p-4 text-sm text-warning">Run supabase/migrations/0008_expenses_documents.sql in the Supabase SQL editor and reload to use these settings.</p>;
}

/** Template editor: one look for every document, plus the footer, bank and UPI QR, and the signature. */
export function DocumentsForm() {
  const tenant = useStore((s) => s.tenant);
  const update = useStore((s) => s.updateTenant);
  const uploadMedia = useStore((s) => s.uploadMedia);
  const input = React.useRef<HTMLInputElement>(null);
  if (!tenant.docs) return <NeedsMigration />;
  const docs = tenant.docs;
  const set = (patch: Partial<DocSettings>) => update({ docs: { ...docs, ...patch } });
  const onSignature = (file?: File) => {
    if (!file) return;
    uploadMedia(file, file.name).then((signaturePath) => set({ signaturePath }), (e: unknown) => toast.error("The signature was not uploaded", { description: e instanceof Error ? e.message : undefined }));
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">Design</p>
        <p className="text-xs text-text-muted">Used on quotations, confirmations, invoices, credit notes and menu cards.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {docThemes.map((t) => (
            <button key={t.id} type="button" aria-pressed={docs.theme === t.id} onClick={() => set({ theme: t.id })} className={cn("relative overflow-hidden rounded-xl border-2 text-left transition-colors", docs.theme === t.id ? "border-primary" : "border-transparent hover:border-border")}>
              {/* A real header in that theme, shrunk down, so the preview cannot drift from the documents. */}
              <div className="pointer-events-none h-24 overflow-hidden bg-surface-muted p-2" aria-hidden>
                <div className="w-[200%] origin-top-left scale-50">
                  <div className={docFrame(t.id)} style={docStyle(tenant.brandColor, t.id)}>
                    <ThemedHeader theme={t.id} />
                    <div className="space-y-2 p-5"><div className="h-2 w-2/3 rounded bg-border" /><div className="h-2 w-1/2 rounded bg-border" /></div>
                  </div>
                </div>
              </div>
              <div className="p-3"><p className="text-sm font-medium">{t.label}</p><p className="text-xs text-text-muted">{t.help}</p></div>
              {docs.theme === t.id && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-fg"><Check className="size-4" strokeWidth={2.5} /></span>}
            </button>
          ))}
        </div>
      </div>
      <Field label="Footer note" hint="Printed on every document, above the signature. FSSAI licence, thank-you line, office hours."><Textarea rows={3} value={docs.footer} onChange={(e) => set({ footer: e.target.value })} placeholder={"FSSAI Lic. No. 10719999000123\nThank you for choosing us."} /></Field>
      <div className="space-y-3 rounded-xl border p-4">
        <ToggleRow checked={docs.showBank} onCheckedChange={(showBank) => set({ showBank })} label="Show bank details on invoices and confirmations" />
        <ToggleRow checked={docs.showUpiQr} onCheckedChange={(showUpiQr) => set({ showUpiQr })} label="Show a UPI QR for the amount due" />
      </div>
      <div>
        <p className="text-sm font-medium">Signature</p>
        <p className="text-xs text-text-muted">A photo of the authorised signatory&apos;s signature on white paper, cropped close.</p>
        <div className="mt-2 flex items-center gap-3">
          {docs.signaturePath ? <img src={mediaUrl(docs.signaturePath)} alt="Signature" className="h-14 rounded-lg border bg-white object-contain p-1" /> : <span className="grid h-14 w-32 place-items-center rounded-lg border border-dashed text-xs text-text-muted">None yet</span>}
          <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onSignature(e.target.files?.[0])} />
          <Button onClick={() => input.current?.click()}><ImagePlus strokeWidth={1.75} />{docs.signaturePath ? "Replace" : "Upload"}</Button>
          {docs.signaturePath && <Button variant="ghost" size="icon" aria-label="Remove signature" onClick={() => set({ signaturePath: undefined })}><Trash2 strokeWidth={1.75} /></Button>}
        </div>
      </div>
      <p className="text-xs text-text-muted">Document numbers and terms are under Numbering and terms.</p>
    </div>
  );
}

/** DocHeader reads the saved theme, so previews render each theme by overriding it for their subtree. */
function ThemedHeader({ theme }: { theme: DocSettings["theme"] }) {
  const tenant = useStore((s) => s.tenant);
  return (
    <DocThemeContext.Provider value={{ ...(tenant.docs ?? defaultDocs), theme }}>
      <DocHeader title="Tax invoice" lines={["INV/26-27/0001"]} />
    </DocThemeContext.Provider>
  );
}

/** The caterer's public catalogue link and its QR, for Instagram bios, visiting cards and the shop counter. */
export function PublicMenuForm() {
  const tenant = useStore((s) => s.tenant);
  const update = useStore((s) => s.updateTenant);
  const [slug, setSlug] = React.useState(tenant.publicSlug || tenant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40));
  const [copied, setCopied] = React.useState(false);
  if (!tenant.docs) return <NeedsMigration />;
  const valid = /^[a-z0-9][a-z0-9-]{2,39}$/.test(slug);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/m/${tenant.publicSlug}`;
  const save = () => {
    update({ publicSlug: slug, publicMenu: true });
    toast.success("Public menu is live", { description: `/m/${slug}` });
  };
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">A menu page anyone can open</p>
        <p className="text-xs text-text-muted">Shows your dishes and packages with photos and an &quot;Enquire on WhatsApp&quot; button. No login, no ordering.</p>
      </div>
      <Field label="Page address" hint={valid ? `Your link: ${typeof window === "undefined" ? "" : window.location.origin}/m/${slug}` : "3 to 40 lowercase letters, numbers and hyphens"} error={slug && !valid ? "Use lowercase letters, numbers and hyphens only" : ""}>
        <div className="flex gap-2"><Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} /><Button variant="primary" disabled={!valid || (slug === tenant.publicSlug && tenant.publicMenu)} onClick={save}>{tenant.publicMenu ? "Update" : "Publish"}</Button></div>
      </Field>
      {tenant.publicSlug && (
        <>
          <div className="space-y-3 rounded-xl border p-4">
            <ToggleRow checked={!!tenant.publicMenu} onCheckedChange={(publicMenu) => update({ publicMenu })} label="Menu page is live" />
            <ToggleRow checked={!!tenant.publicPrices} onCheckedChange={(publicPrices) => update({ publicPrices })} label="Show prices on it" />
          </div>
          {tenant.publicMenu && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-surface-muted p-4">
              <QrCode value={url} label="QR code for your public menu" className="size-28 rounded-lg p-1" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="break-all text-sm font-medium">{url}</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>{copied ? <Check strokeWidth={1.75} /> : <Copy strokeWidth={1.75} />}{copied ? "Copied" : "Copy link"}</Button>
                  <Button variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink strokeWidth={1.75} />Open</a></Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
