"use client";

import { FileDown } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { docLanguages } from "@/lib/doc-i18n";
import type { EventFunction, Locale } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";

export type PdfKind = "quote" | "menu" | "confirmation" | "invoice" | "credit" | "bill" | "itemised" | "workorder";

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
export function DownloadPdf({ kind, id, lang, variant = "secondary", day, label = "Download PDF", className }: { kind: PdfKind; id: string; lang: Locale; variant?: "primary" | "secondary" | "ghost"; day?: string; label?: string; className?: string }) {
  const [busy, setBusy] = React.useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/pdf?kind=${kind}&id=${id}&lang=${lang}${day ? `&day=${day}` : ""}`);
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
  return <Button variant={variant} loading={busy} onClick={download} className={className}><FileDown strokeWidth={1.75} />{label}</Button>;
}

/**
 * The two ways to download an event document: the full PDF with every day, and one PDF per day with that day's
 * events, menus and prices. With a single day there is just the full PDF.
 */
export function PdfDownloads({ kind, id, lang, functions, className }: { kind: "quote" | "menu" | "confirmation"; id: string; lang: Locale; functions: EventFunction[]; className?: string }) {
  const days = [...new Set(functions.map((f) => f.date).filter(Boolean))].sort();
  return (
    <div className={cn("space-y-2 print:hidden", className)}>
      <DownloadPdf kind={kind} id={id} lang={lang} variant="primary" label={days.length > 1 ? `Full PDF · all ${days.length} days` : "Download PDF"} className="w-full sm:w-auto" />
      {days.length > 1 && (
        <div className="rounded-xl border p-2">
          <p className="px-1 pb-1 text-xs font-medium text-text-muted">One PDF per day</p>
          <div className="flex flex-wrap gap-2">
            {days.map((d, i) => {
              const n = functions.filter((f) => f.date === d).length;
              return <DownloadPdf key={d} kind={kind} id={id} lang={lang} day={d} variant="ghost" label={`Day ${i + 1} · ${fmtDate(d, { weekday: "short", day: "numeric", month: "short" })} · ${n} ${n === 1 ? "event" : "events"}`} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
