"use client";

import { Camera, DatabaseZap, Eraser } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { useOps } from "@/lib/operations";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function OpsGate({ children }: { children: React.ReactNode }) {
  const ready = useOps((s) => s.ready);
  if (!ready) return <EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0006_operations.sql in the Supabase SQL editor, then reload this page. It creates the tables for vehicles, trips and the event-day record." />;
  return <>{children}</>;
}

/** Opens the phone camera (or a file picker on a computer) and uploads the photo to this caterer's storage. */
export function PhotoButton({ label, onUploaded, variant = "secondary", size = "md", className }: { label: string; onUploaded: (path: string) => void; variant?: "primary" | "secondary" | "ghost"; size?: "md" | "lg"; className?: string }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onUploaded(await useStore.getState().uploadMedia(file, file.name || "photo.jpg"));
    } catch (e) {
      toast.error("The photo could not be uploaded", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => upload(e.target.files?.[0])} />
      <Button variant={variant} size={size} className={className} loading={busy} onClick={() => input.current?.click()}><Camera strokeWidth={1.75} />{label}</Button>
    </>
  );
}

/** Finger or mouse signature, handed back as a PNG when there is something on it. */
export function SignaturePad({ onChange }: { onChange: (png: Blob | null) => void }) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const [empty, setEmpty] = React.useState(true);

  React.useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    // Draw at device resolution so the signature is crisp on phones.
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    canvas.current!.setPointerCapture(e.pointerId);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    ctx.lineTo(...point(e));
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    canvas.current!.toBlob((b) => onChange(b), "image/png");
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative">
        {/* Always white, so the signature reads the same on screen, in dark mode and on the saved image. */}
        <canvas ref={canvas} aria-label="Sign here" className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-border bg-white" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
        <span className={cn("pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-gray-400", !empty && "hidden")}>Client signs here</span>
      </div>
      {!empty && <Button variant="ghost" className="mt-1" onClick={clear}><Eraser strokeWidth={1.75} />Clear</Button>}
    </div>
  );
}
