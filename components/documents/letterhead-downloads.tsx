"use client";

import Link from "next/link";
import { DownloadPdf } from "@/components/documents/doc-actions";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

/** Order → Documents: the menu on the caterer's letterhead, for every event or one at a time. */
export function LetterheadDownloads({ order }: { order: Order }) {
  const letterhead = useStore((s) => s.tenant.docs?.letterhead);
  const fns = [...order.functions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return (
    <div className="border-t pt-3">
      <p className="mb-2 text-xs font-medium text-text-muted">
        Menu on your letterhead · {letterhead?.style === "upload" && letterhead.filePath ? "your uploaded design" : "designed letterhead"}
        {!letterhead && <> · <Link href="/settings?tab=documents" className="text-primary hover:underline">add your logo and details</Link></>}
      </p>
      <div className="flex flex-wrap gap-2">
        <DownloadPdf kind="letterhead" id={order.id} lang="en" variant="primary" label={fns.length > 1 ? `Letterhead menu · all ${fns.length} events` : "Letterhead menu"} />
        {fns.length > 1 && fns.map((f) => <DownloadPdf key={f.id} kind="letterhead" id={order.id} event={f.id} lang="en" variant="ghost" label={`${f.name}${f.date ? ` · ${fmtDate(f.date, { day: "numeric", month: "short" })}` : ""}`} />)}
      </div>
    </div>
  );
}
