"use client";

import QRCode from "qrcode";
import * as React from "react";
import { BrandMark } from "@/components/settings/tenant-forms";
import { defaultDocs, mediaUrl } from "@/lib/db";
import { useStore } from "@/lib/store";
import { docT } from "@/lib/doc-i18n";
import type { DocSettings, DocTheme, Locale, Tenant } from "@/lib/types";
import { cn, money } from "@/lib/utils";

/** A QR code drawn as one SVG path, so it prints sharp at any size. */
export function QrCode({ value, className, label }: { value: string; className?: string; label: string }) {
  const path = React.useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y++) for (let x = 0; x < modules.size; x++) if (modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, size: modules.size + 4 };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label={label} className={cn("bg-white", className)} shapeRendering="crispEdges">
      <path d={path.d} fill="#111" />
    </svg>
  );
}

/** A UPI link any payment app opens with the payee and amount filled in. */
export function upiLink(tenant: Pick<Tenant, "upiId" | "name">, amount?: number, note?: string) {
  const q = new URLSearchParams({ pa: tenant.upiId, pn: tenant.name, cu: "INR" });
  if (amount && amount > 0) q.set("am", amount.toFixed(2));
  if (note) q.set("tn", note.slice(0, 60));
  return `upi://pay?${q.toString()}`;
}

export const docThemes: { id: DocTheme; label: string; help: string }[] = [
  { id: "classic", label: "Classic", help: "Your brand colour across the top" },
  { id: "minimal", label: "Minimal", help: "White page, a thin brand line" },
  { id: "royal", label: "Royal", help: "Deep charcoal with gold, for weddings" },
  { id: "festive", label: "Festive", help: "Warm band with a border, for celebrations" },
  { id: "modern", label: "Modern", help: "A bold bar down the left edge" },
  { id: "mono", label: "Black and white", help: "Saves ink on office printers" },
];

/** Lets a preview show a theme other than the saved one. */
export const DocThemeContext = React.createContext<DocSettings | null>(null);

export function useDocs(): DocSettings {
  const override = React.useContext(DocThemeContext);
  const saved = useStore((s) => s.tenant.docs);
  return override ?? saved ?? defaultDocs;
}

/** Outer look of a document for the chosen theme: the frame, plus the colours the header and rules use. */
export function docFrame(theme: DocTheme) {
  return cn(
    "overflow-hidden bg-surface text-sm print:rounded-none print:shadow-none",
    theme === "festive" ? "rounded-xl border-4 border-double border-brand" : "rounded-xl border shadow-card print:border-0",
    theme === "modern" && "border-l-8 border-l-brand",
  );
}

/** Sets the brand colour for a document; black and white prints in black whatever the brand is. */
export const docStyle = (brandColor: string, theme: DocTheme) => ({ "--brand": theme === "mono" ? "#111111" : brandColor }) as React.CSSProperties;

/** Document header in the chosen theme: name, contact and GSTIN on one side; title, number and date on the other. */
export function DocHeader({ title, lines, contact = false }: { title: string; lines: string[]; contact?: boolean }) {
  const tenant = useStore((s) => s.tenant);
  const { theme } = useDocs();
  const banded = theme === "classic" || theme === "festive" || theme === "royal";
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8",
        banded ? "text-brand-fg" : "text-text",
        theme === "classic" && "bg-brand",
        theme === "festive" && "bg-[linear-gradient(135deg,var(--brand),color-mix(in_oklab,var(--brand)_60%,#d4a017))]",
        theme === "royal" && "border-b-4 border-double border-[#c9a227] bg-[#1f1a17] text-[#f5e9c8]",
        (theme === "minimal" || theme === "mono") && "border-b-2 border-brand",
        theme === "modern" && "pb-3",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {theme !== "mono" && <BrandMark className="size-12" />}
        <div className="min-w-0">
          <p className={cn("truncate font-heading text-xl font-bold", theme === "royal" && "font-serif tracking-wide text-[#e6c766]", (theme === "minimal" || theme === "modern") && "text-brand")}>{tenant.name}</p>
          <p className="truncate text-xs opacity-80">{tenant.tagline}</p>
          {contact && <p className="text-xs opacity-80">{[tenant.address, tenant.phone].filter(Boolean).join(" · ")}</p>}
          {contact && tenant.gstin && <p className="tnum text-xs opacity-80">GSTIN {tenant.gstin}</p>}
        </div>
      </div>
      <div className="ml-auto text-right">
        <p className={cn("font-heading font-semibold", theme === "modern" ? "text-2xl text-brand" : "text-base", theme === "royal" && "font-serif text-[#e6c766]")}>{title}</p>
        {lines.filter(Boolean).map((l) => <p key={l} className="tnum text-xs opacity-80">{l}</p>)}
      </div>
    </header>
  );
}

/** Bank details, a UPI QR for the amount due, the footer note and the signature, as the caterer set them up. */
export function DocPayBlock({ due, note, signed = true, lang = "en" }: { due?: number; note?: string; signed?: boolean; lang?: Locale }) {
  const t = docT(lang);
  const tenant = useStore((s) => s.tenant);
  const docs = useDocs();
  const qr = docs.showUpiQr && !!tenant.upiId && (due ?? 1) > 0;
  return (
    <div className="grid gap-4 border-t pt-4 text-xs text-text-muted sm:grid-cols-[1fr_auto]">
      <div className="flex gap-4">
        {qr && (
          <div className="shrink-0 text-center">
            <QrCode value={upiLink(tenant, due, note)} label={`UPI QR to pay ${due ? money(due) : tenant.name}`} className="size-24 rounded-md border p-1" />
            <p className="mt-1">{t("scanToPay")}{due ? ` ${money(due)}` : ""}</p>
          </div>
        )}
        <div className="space-y-1">
          {docs.showBank && tenant.bankAccount && <p className="tnum"><span className="font-medium text-text">{t("bank")}: </span>{tenant.bankName} · A/c {tenant.bankAccount} · IFSC {tenant.ifsc}</p>}
          {tenant.upiId && <p className="tnum"><span className="font-medium text-text">{t("upi")}: </span>{tenant.upiId}</p>}
          {docs.footer && <p className="whitespace-pre-line pt-1">{docs.footer}</p>}
        </div>
      </div>
      {signed && (
        <div className="self-end text-right">
          {docs.signaturePath && <img src={mediaUrl(docs.signaturePath)} alt="Signature" className="ml-auto h-12 object-contain" />}
          <p className="mt-1 border-t border-dashed pt-1">{lang === "en" ? `${t("for")} ${tenant.name}` : `${tenant.name} ${t("for")}`}</p>
          <p>{t("signatory")}</p>
        </div>
      )}
    </div>
  );
}
