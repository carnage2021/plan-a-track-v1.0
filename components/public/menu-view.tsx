"use client";

import { MessageCircle, Phone, Search, Sparkles, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { VegMark } from "@/components/shared/badges";
import { Input } from "@/components/ui/input";
import { Chip, Skeleton } from "@/components/ui/primitives";
import { mediaUrl } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import type { Diet } from "@/lib/types";
import { cn, fmtDate, initials, money, whatsappLink } from "@/lib/utils";

// Pages anyone can open without signing in: the caterer's catalogue and the table menu of one function.
// Data comes from the public_catalogue and public_event_menu database functions in 0008.

export interface PublicTenant { name: string; tagline: string; city?: string; phone: string; logo?: string; brand: string; prices?: boolean }
export interface PublicItem { id: string; category: string; name: string; local: string; diet: Diet; description: string; photo?: string; bestseller?: boolean; unit?: string; price?: number; note?: string }
export interface PublicCategory { id: string; name: string; sort?: number }
export interface Catalogue { tenant: PublicTenant; categories: PublicCategory[]; items: PublicItem[]; packages: { name: string; description: string; minPax: number; price?: number }[] }
export interface EventMenu { tenant: PublicTenant; function: { name: string; date: string; eventType: string }; categories: PublicCategory[]; items: PublicItem[] }

/** Calls one of the public database functions; null means the page does not exist or is switched off. */
export function usePublic<T>(fn: "public_catalogue" | "public_event_menu", args: Record<string, string>) {
  const [state, setState] = React.useState<{ data: T | null; loading: boolean }>({ data: null, loading: true });
  const key = JSON.stringify(args);
  React.useEffect(() => {
    let live = true;
    supabase()
      .rpc(fn, JSON.parse(key))
      .then(({ data, error }) => live && setState({ data: error ? null : ((data as T) ?? null), loading: false }));
    return () => {
      live = false;
    };
  }, [fn, key]);
  return state;
}

export function PublicShell({ tenant, children }: { tenant: PublicTenant; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-text" style={{ "--brand": tenant.brand } as React.CSSProperties}>
      <header className="bg-brand text-brand-fg">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-6 md:py-8">
          {tenant.logo ? <img src={mediaUrl(tenant.logo)} alt="" className="size-14 rounded-xl bg-white object-contain p-1" /> : <span className="grid size-14 place-items-center rounded-xl bg-white/15 font-heading text-lg font-bold">{initials(tenant.name)}</span>}
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold md:text-3xl">{tenant.name}</h1>
            <p className="text-sm opacity-85">{[tenant.tagline, tenant.city].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-text-muted">Menu by {tenant.name}{tenant.phone && ` · ${tenant.phone}`}</footer>
    </div>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
      <div>
        <UtensilsCrossed className="mx-auto size-10 text-text-muted" strokeWidth={1.5} />
        <h1 className="mt-3 font-heading text-xl font-semibold">This {what} is not available</h1>
        <p className="mt-1 text-sm text-text-muted">The link may be old, or the caterer has switched the page off.</p>
      </div>
    </div>
  );
}

export const Loading = () => <div className="mx-auto max-w-5xl space-y-4 p-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;

function DishCard({ item, showPrice }: { item: PublicItem; showPrice?: boolean }) {
  return (
    <article className="flex gap-3 rounded-2xl border bg-surface p-3 sm:flex-col sm:p-0">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-primary-soft sm:aspect-[4/3] sm:size-auto sm:rounded-b-none sm:rounded-t-2xl">
        {item.photo ? <Image src={mediaUrl(item.photo)!} alt={item.name} fill sizes="(max-width: 640px) 96px, 320px" className="object-cover" /> : <UtensilsCrossed className="absolute inset-0 m-auto size-8 text-accent-gold" strokeWidth={1.5} />}
      </div>
      <div className="min-w-0 sm:p-4 sm:pt-1">
        <p className="flex items-start gap-2 font-medium leading-snug"><VegMark diet={item.diet} className="mt-0.5" /><span>{item.name}</span></p>
        {item.local && <p className="text-sm text-text-muted">{item.local}</p>}
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{item.description}</p>}
        {item.note && <p className="mt-1 text-xs text-warning">{item.note}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {item.bestseller && <span className="inline-flex items-center gap-1 rounded-full bg-accent-gold/15 px-2 py-0.5 text-[11px] font-medium text-accent-gold"><Sparkles className="size-3" />Bestseller</span>}
          {showPrice && item.price != null && <span className="tnum text-sm font-semibold">{money(item.price)}<span className="font-normal text-text-muted"> {item.unit === "plate" ? "per plate" : item.unit === "counter" ? "per counter" : ""}</span></span>}
        </div>
      </div>
    </article>
  );
}

/** Category chips, search and the dish grid. */
export function DishGrid({ categories, items, showPrice }: { categories: PublicCategory[]; items: PublicItem[]; showPrice?: boolean }) {
  const [cat, setCat] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [diet, setDiet] = React.useState<"all" | "veg" | "jain">("all");
  const cats = [...categories].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).filter((c) => items.some((i) => i.category === c.id));
  const match = (i: PublicItem) => (cat === "all" || i.category === cat) && (diet === "all" || (diet === "veg" ? i.diet !== "nonveg" : i.diet === "jain")) && (!q || `${i.name} ${i.local}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} /><Input aria-label="Search dishes" className="pl-9" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>All</Chip>
          {cats.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} className="shrink-0">{c.name}</Chip>)}
          <span className="mx-1 w-px shrink-0 bg-border" />
          <Chip active={diet === "veg"} onClick={() => setDiet(diet === "veg" ? "all" : "veg")} className="shrink-0">Veg only</Chip>
          <Chip active={diet === "jain"} onClick={() => setDiet(diet === "jain" ? "all" : "jain")} className="shrink-0">Jain</Chip>
        </div>
      </div>
      {cats.map((c) => {
        const list = items.filter((i) => i.category === c.id && match(i));
        if (!list.length) return null;
        return (
          <section key={c.id} className="mt-6">
            <h2 className="font-heading text-xl font-semibold">{c.name}</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((i) => <DishCard key={i.id} item={i} showPrice={showPrice} />)}</div>
          </section>
        );
      })}
      {!items.some(match) && <p className="py-12 text-center text-sm text-text-muted">No dishes match.</p>}
    </>
  );
}

export function CataloguePage({ data }: { data: Catalogue }) {
  const { tenant } = data;
  const enquire = whatsappLink(tenant.phone, `Hi ${tenant.name}, I saw your menu online and would like a quotation.\nEvent: \nDate: \nGuests: `);
  return (
    <PublicShell tenant={tenant}>
      <main className="mx-auto max-w-5xl px-4 pb-28">
        {data.packages.length > 0 && (
          <section className="mt-6">
            <h2 className="font-heading text-xl font-semibold">Packages</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.packages.map((p) => (
                <article key={p.name} className="rounded-2xl border bg-surface p-4">
                  <p className="font-heading text-lg font-semibold">{p.name}</p>
                  {p.description && <p className="mt-1 text-sm text-text-muted">{p.description}</p>}
                  <p className="tnum mt-2 text-sm">{p.price != null && <span className="font-semibold">{money(p.price)} per plate</span>}{p.minPax > 0 && <span className="text-text-muted">{p.price != null ? " · " : ""}from {p.minPax} guests</span>}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        <div className="mt-6"><DishGrid categories={data.categories} items={data.items} showPrice={tenant.prices} /></div>
      </main>
      {tenant.phone && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-surface/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl gap-2">
            <a href={enquire} target="_blank" rel="noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25d366] font-medium text-white"><MessageCircle className="size-5" strokeWidth={1.75} />Enquire on WhatsApp</a>
            <a href={`tel:${tenant.phone}`} aria-label={`Call ${tenant.name}`} className="grid size-12 place-items-center rounded-xl border bg-surface"><Phone className="size-5" strokeWidth={1.75} /></a>
          </div>
        </div>
      )}
    </PublicShell>
  );
}

export function EventMenuPage({ data }: { data: EventMenu }) {
  return (
    <PublicShell tenant={data.tenant}>
      <main className="mx-auto max-w-5xl px-4 pb-10">
        <div className="py-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{data.function.eventType}</p>
          <h2 className="mt-1 font-heading text-3xl font-bold">{data.function.name}</h2>
          <p className="mt-1 text-sm text-text-muted">{fmtDate(data.function.date, { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className={cn("mx-auto mt-3 h-1 w-16 rounded-full bg-brand")} />
        </div>
        <DishGrid categories={data.categories} items={data.items} />
      </main>
    </PublicShell>
  );
}
