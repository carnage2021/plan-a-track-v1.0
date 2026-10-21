"use client";

import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ScanResult = "ok" | "repeat" | "bad";

interface Detector { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }

/** A short tone on each scan, so the store person does not have to look at the screen. */
function beep(good: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = good ? 1200 : 300;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (good ? 0.08 : 0.25));
    osc.onended = () => void ctx.close();
  } catch {}
  navigator.vibrate?.(good ? 40 : [80, 60, 80]);
}

/**
 * Camera QR scanner with a typed-code fallback. The phone's own QR reader is used where the browser has
 * one; otherwise jsQR reads the frames. A barcode gun works too: it types into the code box and presses Enter.
 */
export function Scanner({ onCode, paused }: { onCode: (text: string) => Promise<ScanResult> | ScanResult; paused?: boolean }) {
  const video = React.useRef<HTMLVideoElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [on, setOn] = React.useState(false);
  const [error, setError] = React.useState("");
  const [flash, setFlash] = React.useState<ScanResult | null>(null);
  const [typed, setTyped] = React.useState("");
  const last = React.useRef({ text: "", at: 0 });
  const busy = React.useRef(false);
  const handler = React.useRef(onCode);
  React.useEffect(() => {
    handler.current = onCode;
  }, [onCode]);

  const handle = React.useCallback(async (text: string) => {
    const now = Date.now();
    // The same code held in front of the camera is read many times a second; count it once.
    if (busy.current || (text === last.current.text && now - last.current.at < 2500)) return;
    busy.current = true;
    last.current = { text, at: now };
    const result = await handler.current(text);
    beep(result === "ok");
    setFlash(result);
    setTimeout(() => setFlash(null), 600);
    busy.current = false;
  }, []);

  React.useEffect(() => {
    if (!on || paused) return;
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = BD ? new BD({ formats: ["qr_code"] }) : null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        let lastTick = 0;
        const tick = async (t: number) => {
          if (stopped) return;
          frame = requestAnimationFrame(tick);
          if (t - lastTick < 180 || !video.current || video.current.readyState < 2) return;
          lastTick = t;
          const v = video.current;
          if (detector) {
            const found = await detector.detect(v).catch(() => []);
            if (found[0]?.rawValue) void handle(found[0].rawValue);
            return;
          }
          const c = canvas.current!;
          const w = 480;
          const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          if (code?.data) void handle(code.data);
        };
        frame = requestAnimationFrame(tick);
      } catch (e) {
        setError(e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message) ? "Camera permission was refused. Allow it in the browser settings, or type the codes below." : "No camera found. Type the codes below, or use a barcode scanner.");
        setOn(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on, paused, handle]);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    last.current = { text: "", at: 0 };
    void handle(typed.trim());
    setTyped("");
  };

  return (
    <div className="space-y-2">
      <div className={cn("relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-black text-white transition-shadow sm:aspect-video", flash === "ok" && "ring-4 ring-success", flash === "bad" && "ring-4 ring-danger", flash === "repeat" && "ring-4 ring-warning")}>
        <video ref={video} playsInline muted className={cn("absolute inset-0 size-full object-cover", !on && "hidden")} />
        <canvas ref={canvas} className="hidden" />
        {on ? (
          <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        ) : (
          <div className="p-6 text-center">
            <Camera className="mx-auto size-10 opacity-70" strokeWidth={1.5} />
            <p className="mt-2 text-sm opacity-80">{error || "Point the camera at a label to scan it"}</p>
            <Button variant="primary" className="mt-3" onClick={() => { setError(""); setOn(true); }}><Camera strokeWidth={1.75} />Start camera</Button>
          </div>
        )}
        {on && <Button variant="secondary" size="icon" className="absolute right-2 top-2" aria-label="Stop camera" onClick={() => setOn(false)}><CameraOff strokeWidth={1.75} /></Button>}
      </div>
      <form onSubmit={submitTyped} className="flex gap-2">
        <div className="relative flex-1">
          <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
          <Input aria-label="Label code" className="pl-9 font-mono uppercase" placeholder="Type a code like C-000042, or use a scanner" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" spellCheck={false} />
        </div>
        <Button type="submit" disabled={!typed.trim()}>Add</Button>
      </form>
    </div>
  );
}
