"use client";

import * as React from "react";
import { LetterheadMenu } from "@/components/documents/letterhead-menu";
import { mediaUrl } from "@/lib/db";
import { defaultLetterhead, letterheadBooking, sampleBooking } from "@/lib/letterhead";
import { useFoodTypes } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { Letterhead, Order } from "@/lib/types";

/** The account's letterhead: the saved one over the starting details; an upload without its file falls back to the design. */
export function useLetterhead(): Letterhead {
  const tenant = useStore((s) => s.tenant);
  return React.useMemo(() => {
    const lh = { ...defaultLetterhead(tenant), ...tenant.docs?.letterhead };
    return lh.style === "upload" && !lh.filePath ? { ...lh, style: "designed" } : lh;
  }, [tenant]);
}

/**
 * The print page's letterhead menu: a booking (all events, or one with `eventId`), the made-up sample, or the blank
 * letterhead. With an uploaded design the page is transparent and names the design's file for the PDF route.
 */
export function LetterheadDoc({ order, eventId, mode }: { order?: Order; eventId?: string; mode?: "sample" | "blank" }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const client = useStore((s) => s.clients.find((c) => c.id === order?.clientId));
  const foodTypes = useFoodTypes();
  const lh = useLetterhead();
  const booking = React.useMemo(
    () => (mode || !order ? sampleBooking(tenant.name) : letterheadBooking({ number: order.number, functions: order.functions.filter((f) => !eventId || f.id === eventId), client, items, categories, packages, foodTypes, brand: tenant.name })),
    [mode, order, eventId, client, items, categories, packages, foodTypes, tenant.name],
  );
  const upload = lh.style === "upload";

  React.useEffect(() => {
    document.title = mode === "blank" ? `${tenant.name.replace(/[^\p{L}\p{N}]+/gu, "")}_Letterhead` : booking.fileName;
    const body = document.body;
    if (upload && lh.filePath) {
      body.dataset.letterhead = mediaUrl(lh.filePath) ?? "";
      body.dataset.letterheadType = lh.fileType ?? "pdf";
      // The design goes under these pages, so nothing here may paint a background.
      for (const el of [document.documentElement, body, body.querySelector<HTMLElement>("[data-theme]")]) if (el) el.style.background = "transparent";
    }
  }, [mode, tenant.name, booking.fileName, upload, lh.filePath, lh.fileType]);

  return <LetterheadMenu booking={booking} lh={lh} brand={tenant.name} signature={mediaUrl(tenant.docs?.signaturePath)} blank={mode === "blank"} />;
}
