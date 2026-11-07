"use client";

import { ChevronRight, Gift, MessageCircle, Phone, Search, Sparkles, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { VegMark } from "@/components/shared/badges";
import { Input } from "@/components/ui/input";
import { Chip, Skeleton } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { mediaUrl } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import type { Diet } from "@/lib/types";
import { cn, fmtDate, initials, money, whatsappLink } from "@/lib/utils";

// Pages anyone can open without signing in: the caterer's catalogue and the table menu of one function.
// Data comes from the public_catalogue and public_event_menu database functions in 0008.

export interface PublicTenant { name: string; tagline: string; city?: string; phone: string; logo?: string; brand: string; prices?: boolean }
export interface PublicItem { id: string; category: string; name: string; local: string; diet: Diet; description: string; photo?: string; bestseller?: boolean; unit?: string; price?: number; note?: string }
export interface PublicCategory { id: string; name: string; sort?: number; parent?: string | null }
/** A package as the public sees it; courses, extra lines and suggested dishes come with 0029 */
export interface PublicPackage { id?: string; name: string; description: string; minPax: number; price?: number; choices?: { category: string; choose: number }[]; additions?: { name: string; count: number }[]; suggested?: string[] }
export interface Catalogue { tenant: PublicTenant; categories: PublicCategory[]; items: PublicItem[]; packages: PublicPackage[] }
export interface EventMenu { tenant: PublicTenant; function: { name: string; date: string; eventType: string }; categories: PublicCategory[]; items: PublicItem[] }

/** Calls one of the public database functions; null means the page does not exist or is switched off. */
export function usePublic<T>(fn: "public_catalogue" | "public_event_menu" | "public_referral", args: Record<string, string>) {
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
export function DishGrid({ categories: all, items: dishes, showPrice }: { categories: PublicCategory[]; items: PublicItem[]; showPrice?: boolean }) {
  // Guests see the main categories; a dish in a sub-category (Main course › Sabji) shows under its main one.
  const topOf = (id: string) => {
    const seen = new Set<string>();
    let c = all.find((x) => x.id === id);
    while (c?.parent && !seen.has(c.id)) {
      seen.add(c.id);
      const up = all.find((x) => x.id === c!.parent);
      if (!up) break;
      c = up;
    }
    return c?.id ?? id;
  };
  const categories = all.filter((c) => !c.parent || !all.some((x) => x.id === c.parent));
  const items = dishes.map((i) => ({ ...i, category: topOf(i.category) }));
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

/** What a ?ref= link may show: the referrer's first name and the offer. */
export interface PublicReferral {
  name: string;
  code: string;
  offer: { type: "percent" | "amount"; value: number; max: number };
}

export function CataloguePage({ data, referral }: { data: Catalogue; referral?: PublicReferral | null }) {
  const { tenant } = data;
  const [openPkg, setOpenPkg] = React.useState<PublicPackage | null>(null);
  const offer = referral && (referral.offer.type === "percent" ? `${referral.offer.value}% off${referral.offer.max ? ` (up to ${money(referral.offer.max)})` : ""}` : `${money(referral.offer.value)} off`);
  const enquire = whatsappLink(tenant.phone, `Hi ${tenant.name}, I saw your menu online and would like a quotation.${referral ? `\nReferral code: ${referral.code}` : ""}\nEvent: \nDate: \nGuests: `);
  return (
    <PublicShell tenant={tenant}>
      <main className="mx-auto max-w-5xl px-4 pb-28">
        {referral && (
          <section className="mt-6 flex items-center gap-4 rounded-2xl border border-accent-gold/40 bg-accent-gold/10 p-4">
            <Gift className="size-8 shrink-0 text-accent-gold" strokeWidth={1.5} />
            <div>
              <p className="font-heading text-lg font-semibold">{referral.name} invited you: {offer} your booking</p>
              <p className="text-sm text-text-muted">Your code <strong className="tnum tracking-wider text-text">{referral.code}</strong> is added to your WhatsApp enquiry automatically.</p>
            </div>
          </section>
        )}
        {data.packages.length > 0 && (
          <section className="mt-6">
            <h2 className="font-heading text-xl font-semibold">Packages</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.packages.map((p) => (
                <button key={p.id ?? p.name} type="button" onClick={() => setOpenPkg(p)} className="group rounded-2xl border bg-surface p-4 text-left transition-colors hover:border-brand/50">
                  <p className="flex items-center justify-between gap-2 font-heading text-lg font-semibold">{p.name}<ChevronRight className="size-5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} /></p>
                  {p.description && <p className="mt-1 text-sm text-text-muted">{p.description}</p>}
                  <p className="tnum mt-2 text-sm">{p.price != null && <span className="font-semibold">{money(p.price)} per plate</span>}{p.minPax > 0 && <span className="text-text-muted">{p.price != null ? " · " : ""}from {p.minPax} guests</span>}</p>
                  {!!p.choices?.length && <p className="mt-2 line-clamp-2 text-xs text-text-muted">{p.choices.map((c) => `${data.categories.find((x) => x.id === c.category)?.name ?? "Dishes"} ${c.choose}`).join(" · ")}</p>}
                  <p className="mt-2 text-xs font-medium text-brand">{p.suggested?.length ? `See ${p.suggested.length} suggested ${p.suggested.length === 1 ? "dish" : "dishes"}` : "See what it includes"}</p>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="mt-6"><DishGrid categories={data.categories} items={data.items} showPrice={tenant.prices} /></div>
      </main>
      <PackageSheet pkg={openPkg} data={data} onClose={() => setOpenPkg(null)} />
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

/**
 * One package opened on the public menu: what it covers (its courses and extra lines) and the dishes the caterer
 * suggests for it, with their photos, under the course each one fills.
 */
function PackageSheet({ pkg, data, onClose }: { pkg: PublicPackage | null; data: Catalogue; onClose: () => void }) {
  const name = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "";
  // A dish counts under the nearest course of the package it sits inside (Paneer sabji under Main course).
  const courseOf = (categoryId: string) => {
    const seen = new Set<string>();
    for (let at: string | null | undefined = categoryId; at && !seen.has(at); at = data.categories.find((c) => c.id === at)?.parent) {
      seen.add(at);
      if (pkg?.choices?.some((c) => c.category === at)) return at;
    }
    return "";
  };
  const dishes = (pkg?.suggested ?? []).map((id) => data.items.find((i) => i.id === id)).filter((i): i is PublicItem => !!i);
  const groups = [...(pkg?.choices ?? []).map((c) => ({ id: c.category, title: `${name(c.category)} · choose ${c.choose}` })), { id: "", title: pkg?.choices?.length ? "More ideas" : "Suggested dishes" }]
    .map((g) => ({ ...g, list: dishes.filter((d) => courseOf(d.category) === g.id) }))
    .filter((g) => g.list.length);
  return (
    <Sheet open={!!pkg} onOpenChange={(o) => !o && onClose()} title={pkg?.name ?? ""} description={pkg?.description || undefined} wide>
      {pkg && (
        <div className="space-y-5 pb-4">
          {(pkg.price != null || pkg.minPax > 0) && <p className="tnum text-sm">{pkg.price != null && <span className="font-semibold">{money(pkg.price)} per plate</span>}{pkg.minPax > 0 && <span className="text-text-muted">{pkg.price != null ? " · " : ""}from {pkg.minPax} guests</span>}</p>}
          {(!!pkg.choices?.length || !!pkg.additions?.length) && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">The package covers</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {pkg.choices?.map((c) => <span key={c.category} className="rounded-full border bg-surface px-3 py-1 text-sm">{name(c.category)} <span className="font-semibold">{c.choose}</span></span>)}
                {pkg.additions?.map((a, i) => <span key={i} className="rounded-full bg-brand/10 px-3 py-1 text-sm text-brand">{a.name}{a.count ? ` ${a.count}` : ""}</span>)}
              </div>
            </section>
          )}
          {groups.length > 0 ? groups.map((g) => (
            <section key={g.id || "more"}>
              <h3 className="font-heading text-base font-semibold">{g.title}</h3>
              <p className="text-xs text-text-muted">Suggested dishes; you can choose any from the menu</p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {g.list.map((i) => (
                  <article key={i.id} className="overflow-hidden rounded-xl border bg-surface">
                    <div className="relative aspect-[4/3] bg-primary-soft">
                      {i.photo ? <Image src={mediaUrl(i.photo)!} alt={i.name} fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" /> : <UtensilsCrossed className="absolute inset-0 m-auto size-7 text-accent-gold" strokeWidth={1.5} />}
                    </div>
                    <div className="p-2.5">
                      <p className="flex items-start gap-1.5 text-sm font-medium leading-snug"><VegMark diet={i.diet} className="mt-0.5" /><span>{i.name}</span></p>
                      {i.local && <p className="text-xs text-text-muted">{i.local}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-text-muted">Ask us on WhatsApp for dish ideas for this package.</p>}
        </div>
      )}
    </Sheet>
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
