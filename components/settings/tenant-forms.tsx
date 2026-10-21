"use client";

import { ImagePlus, Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/primitives";
import { brandColours } from "@/lib/brand";
import { mediaUrl } from "@/lib/db";
import { useStore } from "@/lib/store";
import type { Tenant } from "@/lib/types";
import { cn, financialYear, initials } from "@/lib/utils";

// The same sections are used by the first-run wizard and the Settings page.

function useTenantField() {
  const tenant = useStore((s) => s.tenant);
  const update = useStore((s) => s.updateTenant);
  const bind = (key: keyof Tenant) => ({
    value: String(tenant[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update({ [key]: e.target.value } as Partial<Tenant>),
  });
  return { tenant, update, bind };
}

export function BusinessForm() {
  const { bind } = useTenantField();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Business name" className="sm:col-span-2"><Input {...bind("name")} /></Field>
      <Field label="Tagline" className="sm:col-span-2" hint="Shown under your name on quotations."><Input {...bind("tagline")} /></Field>
      <Field label="Phone"><Input inputMode="tel" {...bind("phone")} /></Field>
      <Field label="Email"><Input type="email" {...bind("email")} /></Field>
      <Field label="City"><Input {...bind("city")} /></Field>
      <Field label="Address" className="sm:col-span-2"><Textarea {...bind("address")} /></Field>
    </div>
  );
}

export function BrandMark({ className }: { className?: string }) {
  const tenant = useStore((s) => s.tenant);
  return tenant.logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- small logo, shown at a fixed size
    <img src={mediaUrl(tenant.logo)} alt={tenant.name} className={cn("size-10 rounded-lg bg-surface object-contain", className)} />
  ) : (
    <span className={cn("grid size-10 place-items-center rounded-lg bg-brand-fg/15 font-heading text-sm font-bold", className)}>{initials(tenant.name)}</span>
  );
}

export function BrandForm() {
  const { tenant, update } = useTenantField();
  const input = React.useRef<HTMLInputElement>(null);
  const uploadMedia = useStore((s) => s.uploadMedia);
  const onFile = (file?: File) => {
    if (!file) return;
    if (file.size > 300_000) return void toast.error("Logo is too large", { description: "Use an image under 300 KB." });
    uploadMedia(file, file.name).then((path) => update({ logo: path }), (e: unknown) => toast.error("The logo was not uploaded", { description: e instanceof Error ? e.message : undefined }));
  };
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">Logo</span>
          <div className="flex items-center gap-3">
            <div className="grid size-16 place-items-center overflow-hidden rounded-xl border bg-surface-muted text-text-muted">
              {tenant.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- small logo, shown at a fixed size
                <img src={mediaUrl(tenant.logo)} alt="" className="size-full object-contain" />
              ) : (
                <ImagePlus className="size-6" strokeWidth={1.5} />
              )}
            </div>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button onClick={() => input.current?.click()}>{tenant.logo ? "Replace logo" : "Upload logo"}</Button>
            {tenant.logo && <Button variant="ghost" onClick={() => update({ logo: undefined })}>Remove</Button>}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">Brand colour</span>
          <div className="flex flex-wrap gap-2">
            {brandColours.map((c) => (
              <button key={c.value} type="button" title={c.name} aria-label={c.name} aria-pressed={tenant.brandColor === c.value} onClick={() => update({ brandColor: c.value })} className={cn("size-11 rounded-full border-4 border-surface ring-1 ring-border transition-shadow duration-150", tenant.brandColor === c.value && "ring-2 ring-text")} style={{ background: c.value }} />
            ))}
            <label className="grid size-11 place-items-center rounded-full border border-dashed text-text-muted" title="Custom colour">
              <Plus className="size-5" strokeWidth={1.75} />
              <input type="color" value={tenant.brandColor} onChange={(e) => update({ brandColor: e.target.value })} className="sr-only" />
            </label>
          </div>
          <p className="mt-2 text-xs text-text-muted">Used on your quotations, receipts and the booking-mode header. The app itself keeps its own colours.</p>
        </div>
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-text-muted">How clients will see it</span>
        <div className="overflow-hidden rounded-xl border bg-surface shadow-card" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
          <div className="flex items-center gap-3 bg-brand p-4 text-brand-fg">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate font-heading text-base font-semibold">{tenant.name || "Your business name"}</p>
              <p className="truncate text-xs opacity-80">{tenant.tagline}</p>
            </div>
          </div>
          <div className="space-y-2 p-4">
            <p className="text-xs text-text-muted">Quotation · {tenant.quotePrefix}/{financialYear()}/0001</p>
            <div className="h-2 w-3/4 rounded-full bg-surface-muted" />
            <div className="h-2 w-1/2 rounded-full bg-surface-muted" />
            <div className="mt-3 h-8 w-32 rounded-lg bg-brand" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaxBankForm() {
  const { tenant, update, bind } = useTenantField();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="GSTIN" hint="15 characters. Leave blank if you are not registered."><Input className="uppercase" maxLength={15} {...bind("gstin")} /></Field>
      <Field label="GST rate on catering">
        <Select value={tenant.gstRate} onChange={(e) => update({ gstRate: Number(e.target.value) })}>
          {[0, 5, 12, 18].map((r) => <option key={r} value={r}>{r}%</option>)}
        </Select>
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:col-span-2">
        <div>
          <p className="text-sm font-medium">Prices include GST</p>
          <p className="text-xs text-text-muted">Off: GST is added on top of the quoted amount.</p>
        </div>
        <Switch checked={tenant.gstInclusive} onCheckedChange={(v) => update({ gstInclusive: v })} label="Prices include GST" />
      </div>
      <Field label="Bank name and branch"><Input {...bind("bankName")} /></Field>
      <Field label="Account number"><Input inputMode="numeric" {...bind("bankAccount")} /></Field>
      <Field label="IFSC"><Input className="uppercase" {...bind("ifsc")} /></Field>
      <Field label="UPI ID" hint="Shown as a QR on receipts and invoices."><Input {...bind("upiId")} /></Field>
    </div>
  );
}

export function NumberingForm() {
  const { tenant, bind } = useTenantField();
  const fy = financialYear();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {([["quotePrefix", "Quotation prefix"], ["orderPrefix", "Order prefix"], ["invoicePrefix", "Invoice prefix"]] as const).map(([key, label]) => (
        <Field key={key} label={label} hint={`Next: ${tenant[key]}/${fy}/0001`}><Input className="uppercase" maxLength={5} {...bind(key)} /></Field>
      ))}
      <Field label="Terms and conditions" className="sm:col-span-3" hint="Printed at the bottom of every quotation and invoice."><Textarea rows={4} {...bind("terms")} /></Field>
    </div>
  );
}

export function RulesForm() {
  const { tenant, update } = useTenantField();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Kitchen capacity per day (guests)" hint="Dates above this are flagged in the calendar and at enquiry.">
        <Input inputMode="numeric" value={tenant.dailyCapacityPax} onChange={(e) => update({ dailyCapacityPax: Number(e.target.value.replace(/\D/g, "")) })} />
      </Field>
      <Field label="Discount needing owner approval (above %)" hint="Sales can give up to this much on their own.">
        <Input inputMode="numeric" value={tenant.discountApprovalPct} onChange={(e) => update({ discountApprovalPct: Math.min(100, Number(e.target.value.replace(/\D/g, ""))) })} />
      </Field>
      <div className="sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-text-muted">Per-plate discount by guest count</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {tenant.slabs.map((slab, i) => {
            const from = i === 0 ? 1 : (tenant.slabs[i - 1].upTo ?? 0) + 1;
            return (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                <span className="tnum text-sm">{slab.upTo ? `${from} to ${slab.upTo}` : `${from}+`} guests</span>
                <span className="flex items-center gap-1 text-sm text-text-muted">
                  <Input className="tnum !h-9 w-14 text-center" inputMode="numeric" aria-label="Discount percent" value={slab.pct} onChange={(e) => update({ slabs: tenant.slabs.map((s, j) => (j === i ? { ...s, pct: Math.min(50, Number(e.target.value.replace(/\D/g, ""))) } : s)) })} />%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { TeamForm } from "./team-form";
