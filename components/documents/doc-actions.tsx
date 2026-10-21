"use client";

import { FileDown } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { docLanguages } from "@/lib/doc-i18n";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PdfKind = "quote" | "menu" | "confirmation" | "invoice" | "credit";

/** English, Hindi or Gujarati for the document; starts in the client's own language. */
export function DocLangPicker({ value, onChange, className }: { value: Locale; onChange: (l: Locale) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Document language" className={cn("inline-flex rounded-xl border bg-surface p-1 print:hidden", className)}>
      {docLanguages.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={value === l.id} onClick={() => onChange(l.id)} className={cn("h-9 rounded-lg px-3 text-sm font-medium transition-colors", value === l.id ? "bg-primary text-primary-fg" : "text-text-muted hover:text-text")}>{l.label}</button>
      ))}
    </div>
  );
}

/** Saves the document as a real PDF file, made on the server in the chosen language. */
export function DownloadPdf({ kind, id, lang, variant = "secondary" }: { kind: PdfKind; id: string; lang: Locale; variant?: "primary" | "secondary" | "ghost" }) {
  const [busy, setBusy] = React.useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/pdf?kind=${kind}&id=${id}&lang=${lang}`);
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "The PDF could not be made.");
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `${kind}.pdf`;
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await res.blob()), download: name });
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error("No PDF", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return <Button variant={variant} loading={busy} onClick={download}><FileDown strokeWidth={1.75} />Download PDF</Button>;
}
