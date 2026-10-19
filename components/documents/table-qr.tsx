"use client";

import { Copy, ExternalLink, Printer } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/settings/tenant-forms";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { fmtDate } from "@/lib/utils";
import { QrCode } from "./theme";

/** Table tents with a QR to each function's menu, two to an A4 sheet, for guests to scan at their table. */
export function TableQr({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void }) {
  const tenant = useStore((s) => s.tenant);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const functions = [...order.functions].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Table menu QR" description="Guests scan to see the menu of that function, with photos. No prices are shown." wide footer={<Button onClick={printLight}><Printer strokeWidth={1.75} />Print table cards</Button>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
        {functions.map((fn) => {
          const url = `${origin}/m/e/${fn.id}`;
          return (
            <div key={fn.id} className="break-inside-avoid">
              <article className="flex flex-col items-center rounded-2xl border-2 border-brand bg-white p-6 text-center text-gray-900">
                <div className="flex items-center gap-2"><BrandMark className="size-8 bg-brand text-brand-fg" /><p className="font-heading text-lg font-bold">{tenant.name}</p></div>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gray-500">{order.eventType}</p>
                <p className="font-heading text-2xl font-bold">{fn.name}</p>
                <p className="text-sm text-gray-500">{fmtDate(fn.date, { day: "numeric", month: "long" })}</p>
                <QrCode value={url} label={`QR code for the ${fn.name} menu`} className="mt-4 size-40" />
                <p className="mt-3 text-sm font-medium">Scan to see today&apos;s menu</p>
              </article>
              <div className="mt-2 flex gap-2 print:hidden">
                <Button variant="ghost" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}><Copy strokeWidth={1.75} />Copy link</Button>
                <Button variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink strokeWidth={1.75} />Open</a></Button>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
