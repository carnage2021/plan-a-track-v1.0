"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-in");
        io.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Counts up to `to` once it is on screen, in Indian digit grouping. */
export function CountUp({ to, prefix = "" }: { to: number; prefix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => prefix + Math.round(n).toLocaleString("en-IN");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return void (el.textContent = fmt(to));
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1400);
        el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, prefix]);
  return <span ref={ref} className="tnum">{prefix}{to.toLocaleString("en-IN")}</span>;
}

/** Log in and sign-up buttons; someone already signed in gets a way straight back to their workspace. */
export function AuthButtons({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const signedIn = useStore((s) => s.hydrated && s.signedIn);
  if (signedIn)
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button variant="primary" size={size} asChild><Link href="/">Open your workspace<ArrowRight strokeWidth={1.75} /></Link></Button>
      </div>
    );
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button variant={size === "lg" ? "secondary" : "ghost"} size={size} asChild><Link href="/login">Log in</Link></Button>
      <Button variant="primary" size={size} asChild><Link href="/login?mode=signup">Create your account<ArrowRight strokeWidth={1.75} /></Link></Button>
    </div>
  );
}
