"use client";

import { Printer } from "lucide-react";
import * as React from "react";
import { QrCode } from "@/components/documents/theme";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { labelUrl, type StockLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import { printLabels } from "@/lib/ui";

/** Name and size printed on a label, e.g. "Steel dinner plate" and "Bunch of 50". */
export function useLabelText() {
  const { assets, ingredients } = useSupply();
  return React.useCallback(
    (l: StockLabel) => {
      if (l.kind === "asset") return { name: assets.find((a) => a.id === l.itemId)?.name ?? "Item", size: l.single ? "Single piece" : `Bunch of ${l.qty}` };
      const ing = ingredients.find((i) => i.id === l.itemId);
      return { name: ing?.name ?? "Item", size: `${l.qty} ${ing?.unit ?? ""}${l.remaining < l.qty ? ` (${l.remaining} left)` : ""}` };
    },
    [assets, ingredients],
  );
}

/**
 * A4 sticker sheets, 24 labels a page (3 across, 8 down, 70 x 37 mm). Fits the common 24-up label paper;
 * on plain paper, cut along the faint lines and tape the label on.
 */
export function LabelSheet({ labels, open, onOpenChange }: { labels: StockLabel[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const business = useStore((s) => s.tenant.name);
  const text = useLabelText();
  const pages = Array.from({ length: Math.ceil(labels.length / 24) }, (_, i) => labels.slice(i * 24, i * 24 + 24));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${labels.length} ${labels.length === 1 ? "label" : "labels"} to print`} description="A4 sticker paper, 24 a sheet. Print at 100% (actual size), not 'fit to page'." wide footer={<Button variant="primary" onClick={printLabels}><Printer strokeWidth={1.75} />Print labels</Button>}>
      <div className="overflow-x-auto print:overflow-visible">
        {pages.map((page, p) => (
          <div key={p} className="label-page mx-auto mb-6 grid w-[210mm] grid-cols-3 content-start bg-white text-black shadow-card print:mb-0 print:shadow-none" style={{ height: "297mm", gridAutoRows: "37.125mm" }}>
            {page.map((l) => {
              const t = text(l);
              return (
                <div key={l.id} className="flex items-center gap-[2.5mm] overflow-hidden border border-dashed border-gray-200 px-[3mm] print:border-gray-100" style={{ width: "70mm" }}>
                  <QrCode value={labelUrl(l.code)} label={`QR for ${l.code}`} className="h-[30mm] w-[30mm] shrink-0" />
                  <div className="min-w-0 leading-tight">
                    <p className="line-clamp-2 text-[10pt] font-bold">{t.name}</p>
                    <p className="mt-[1mm] text-[9pt]">{t.size}</p>
                    <p className="mt-[1.5mm] font-mono text-[10pt] font-bold tracking-wide">{l.code}</p>
                    <p className="mt-[1mm] truncate text-[7pt] text-gray-500">{business}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
