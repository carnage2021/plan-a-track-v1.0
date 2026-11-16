"use client";

import { Check, FileUp, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { DownloadPdf } from "@/components/documents/doc-actions";
import { LetterheadMenu } from "@/components/documents/letterhead-menu";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { mediaUrl } from "@/lib/db";
import { LH_ACCENT, LH_PRIMARY, defaultLetterhead, sampleBooking } from "@/lib/letterhead";
import { useStore } from "@/lib/store";
import type { Letterhead } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Settings → Documents → Letterhead for menus. Either the designed letterhead filled from the logo, colours and
 * contact details here, or the caterer's own design uploaded as a PDF or picture with the menu printed inside its
 * blank space. Order → Documents → Letterhead menu uses whichever is chosen.
 */
export function LetterheadForm() {
  const tenant = useStore((s) => s.tenant);
  const tenantId = useStore((s) => s.tenantId);
  const update = useStore((s) => s.updateTenant);
  const uploadMedia = useStore((s) => s.uploadMedia);
  const docs = tenant.docs!;
  const lh: Letterhead = { ...defaultLetterhead(tenant), ...docs.letterhead };
  const set = (patch: Partial<Letterhead>) => update({ docs: { ...docs, letterhead: { ...lh, ...patch } } });
  const [busy, setBusy] = React.useState("");
  const logoInput = React.useRef<HTMLInputElement>(null);
  const markInput = React.useRef<HTMLInputElement>(null);
  const designInput = React.useRef<HTMLInputElement>(null);
  const [pdfPages, setPdfPages] = React.useState<number>();
  const booking = React.useMemo(() => sampleBooking(tenant.name), [tenant.name]);

  const onPicture = async (file: File | undefined, key: "logoPath" | "markPath") => {
    if (!file) return;
    if (!/^image\/(svg\+xml|png|jpe?g|webp)$/.test(file.type)) return toast.error("Use an SVG, PNG or JPG file");
    setBusy(key);
    try {
      set({ [key]: await uploadMedia(file, file.name) });
    } catch (e) {
      toast.error("The picture was not uploaded", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy("");
    }
  };

  const onDesign = async (file?: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (/\.(docx?|odt|rtf)$/.test(name)) {
      return toast.error("Save the Word file as a PDF first", { description: "Word: File → Save As → PDF (Canva: Download → PDF). Then upload that PDF here; it keeps your design exactly.", duration: 12000 });
    }
    const pdf = file.type === "application/pdf" || name.endsWith(".pdf");
    if (!pdf && !/^image\/(png|jpeg)$/.test(file.type)) return toast.error("Upload a PDF, PNG or JPG file");
    setBusy("design");
    try {
      let pages: number | undefined;
      if (pdf) {
        // Read it here first, so a broken or locked PDF is caught now rather than at the first download.
        const { PDFDocument } = await import("pdf-lib");
        try {
          pages = (await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })).getPageCount();
        } catch {
          throw new Error("This PDF could not be read. Save it again as a PDF and upload that.");
        }
      }
      const filePath = await uploadMedia(file, file.name);
      setPdfPages(pages);
      set({ style: "upload", filePath, fileType: pdf ? "pdf" : "image", fileName: file.name });
      toast.success("Letterhead uploaded", { description: pages && pages > 1 ? "Page 1 is used for the first page of each menu, page 2 for the pages after it." : "Set the blank space below, then download a sample." });
    } catch (e) {
      toast.error("The letterhead was not uploaded", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy("");
    }
  };

  const upload = lh.style === "upload";
  const previewLh: Letterhead = upload && !lh.filePath ? { ...lh, style: "designed" } : lh;
  return (
    <div className="space-y-4" id="letterhead">
      <div>
        <p className="text-sm font-medium">Letterhead for menus</p>
        <p className="text-xs text-text-muted">Each booking&apos;s menu, printed on your letterhead: Order → Documents → Letterhead menu.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ["designed", "Designed letterhead", "A cover page with your logo and the booking, then the menu pages with your header, footer and colours."],
          ["upload", "Your own design", "Upload your letterhead as a PDF or picture. The menu is printed inside its blank space."],
        ] as const).map(([id, title, help]) => (
          <button key={id} type="button" aria-pressed={lh.style === id} onClick={() => set({ style: id })} className={cn("relative rounded-xl border-2 p-3 text-left transition-colors", lh.style === id ? "border-primary bg-primary/5" : "hover:border-border")}>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-text-muted" data-no-title-case>{help}</p>
            {lh.style === id && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-fg"><Check className="size-4" strokeWidth={2.5} /></span>}
          </button>
        ))}
      </div>

      {upload ? (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input ref={designInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf,image/png,image/jpeg" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void onDesign(e.target.files?.[0]); e.target.value = ""; }} />
            <Button variant={lh.filePath ? "secondary" : "primary"} loading={busy === "design"} onClick={() => designInput.current?.click()}><FileUp strokeWidth={1.75} />{lh.filePath ? "Replace the design" : "Upload your letterhead"}</Button>
            {lh.filePath ? (
              <span className="min-w-0 text-sm" data-no-title-case>
                <a href={mediaUrl(lh.filePath)} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{lh.fileName ?? "Letterhead"}</a>
                <span className="text-text-muted"> · {lh.fileType === "image" ? "picture" : pdfPages ? `PDF, ${pdfPages} ${pdfPages === 1 ? "page" : "pages"}` : "PDF"}</span>
              </span>
            ) : (
              <span className="text-xs text-text-muted">A4 PDF, PNG or JPG. From Word or Canva, save or download it as a PDF.</span>
            )}
          </div>
          <p className="text-xs text-text-muted">A PDF with two pages: the first is used for each menu&apos;s first page, the second for the pages after it.</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Space at the top" hint="In mm, for your header"><Input type="number" min={0} max={150} value={lh.top} onChange={(e) => set({ top: clampMm(e.target.value, 150) })} /></Field>
            <Field label="Space at the bottom" hint="In mm, for your footer"><Input type="number" min={0} max={150} value={lh.bottom} onChange={(e) => set({ bottom: clampMm(e.target.value, 150) })} /></Field>
            <Field label="Space at the sides" hint="In mm"><Input type="number" min={0} max={60} value={lh.side} onChange={(e) => set({ side: clampMm(e.target.value, 60) })} /></Field>
          </div>
          <Colours lh={lh} set={set} />
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap gap-4">
            {([["logoPath", "Logo", "SVG or PNG, the full logo", logoInput], ["markPath", "Watermark (optional)", "The symbol alone, printed very faintly", markInput]] as const).map(([key, title, help, ref]) => (
              <div key={key} className="flex items-center gap-3">
                {lh[key] ? <img src={mediaUrl(lh[key])} alt={title} className="h-16 w-20 rounded-lg border bg-white object-contain p-1" /> : <span className="grid h-16 w-20 place-items-center rounded-lg border border-dashed text-[11px] text-text-muted">None</span>}
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-text-muted">{help}</p>
                  <input ref={ref} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void onPicture(e.target.files?.[0], key); e.target.value = ""; }} />
                  <div className="mt-1 flex gap-1">
                    <Button loading={busy === key} onClick={() => ref.current?.click()}><ImagePlus strokeWidth={1.75} />{lh[key] ? "Replace" : "Upload"}</Button>
                    {lh[key] && <Button variant="ghost" aria-label={`Remove the ${title.toLowerCase()}`} onClick={() => set({ [key]: undefined })}><Trash2 strokeWidth={1.75} /></Button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tagline"><Input value={lh.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="the delicious journey" data-no-title-case /></Field>
            <Field label="Email"><Input type="email" value={lh.email} onChange={(e) => set({ email: e.target.value })} data-no-title-case /></Field>
            <Field label="Phone numbers" hint="One per line"><Textarea rows={3} value={lh.phones} onChange={(e) => set({ phones: e.target.value })} data-no-title-case /></Field>
            <Field label="Address" hint="Two lines, for the footer"><Textarea rows={3} value={lh.address} onChange={(e) => set({ address: e.target.value })} data-no-title-case /></Field>
          </div>
          <Colours lh={lh} set={set} />
        </div>
      )}

      <div className="rounded-xl border bg-surface-muted/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-text-muted">Preview with a sample menu{upload && lh.fileType === "pdf" ? ": the dashed line is the space the menu keeps to" : ""}</p>
          <div className="flex flex-wrap gap-2">
            <DownloadPdf kind="letterhead" id={tenantId} mode="sample" lang="en" variant="ghost" label="Sample menu PDF" />
            {!upload && <DownloadPdf kind="letterhead" id={tenantId} mode="blank" lang="en" variant="ghost" label="Blank letterhead PDF" />}
          </div>
        </div>
        <Preview>
          <LetterheadMenu booking={booking} lh={previewLh} brand={tenant.name} signature={mediaUrl(docs.signaturePath)} backdrop={upload && lh.fileType === "image" ? mediaUrl(lh.filePath) : undefined} guides={upload && lh.fileType === "pdf"} />
        </Preview>
      </div>
    </div>
  );
}

const clampMm = (v: string, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

function Colours({ lh, set }: { lh: Letterhead; set: (p: Partial<Letterhead>) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      {([["primary", "Main colour", "Headings, strips and footer"], ["accent", "Accent colour", "Gold lines and labels"]] as const).map(([key, title, help]) => (
        <label key={key} className="flex items-center gap-2">
          <input type="color" value={lh[key]} onChange={(e) => set({ [key]: e.target.value.toUpperCase() })} className="size-10 cursor-pointer rounded-lg border bg-surface p-1" aria-label={title} />
          <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-text-muted">{help}</span></span>
        </label>
      ))}
      {(lh.primary !== LH_PRIMARY || lh.accent !== LH_ACCENT) && <Button variant="ghost" onClick={() => set({ primary: LH_PRIMARY, accent: LH_ACCENT })}><RotateCcw strokeWidth={1.75} />Maroon and gold</Button>}
    </div>
  );
}

/** The A4 pages shrunk to fit, side by side, scrolling sideways when there are more. */
function Preview({ children }: { children: React.ReactNode }) {
  const scale = 0.34;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex w-max gap-3 [&_.lh-doc]:flex [&_.lh-doc]:gap-3 [&_.lh-page]:shrink-0 [&_.lh-page]:shadow-md" style={{ zoom: scale }}>
        {children}
      </div>
    </div>
  );
}
