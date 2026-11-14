"use client";

import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { DishImage } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { isWithin, lineage } from "@/lib/categories";
import { offered } from "@/lib/packages";
import { useStore } from "@/lib/store";
import type { MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-૿]/g, "");

/**
 * Public menu page (sidebar): dishes suggested for each package, shown with their photos when a visitor opens the
 * package on the public menu ("Starters 2: Paneer Tikka, Hara Bhara Kabab…"). Ideas only; bookings are not affected.
 */
export function PackageSuggestions() {
  const ready = useStore((s) => s.packageSuggestionsReady);
  const owner = useStore((s) => s.myRole === "owner");
  const packages = offered(useStore((s) => s.packages));
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const savePackage = useStore((s) => s.savePackage);
  const [pkgId, setPkgId] = React.useState(packages[0]?.id ?? "");
  const [query, setQuery] = React.useState("");
  const [course, setCourse] = React.useState("");
  const pkg = packages.find((p) => p.id === pkgId) ?? packages[0];

  if (!ready) return <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning">{owner ? "Run supabase/migrations/0029_package_suggestions.sql in the Supabase SQL editor, then reload, to suggest dishes for each package." : "Package suggestions need one database update. Ask the owner to run it."}</p>;
  if (!pkg) return <p className="text-sm text-text-muted">Add a package on the Menu page first.</p>;

  const ids = pkg.publicSuggestions ?? [];
  const save = (next: string[]) => savePackage({ ...pkg, publicSuggestions: next });
  const add = (i: MenuItem) => { save([...ids, i.id]); setQuery(""); };
  const move = (at: number, by: number) => { const next = [...ids]; const [x] = next.splice(at, 1); next.splice(at + by, 0, x); save(next); };
  const courseName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  // The package's own courses come first in the search, so ideas follow what it covers.
  const q = fold(query);
  const results = items
    .filter((i) => i.active && !ids.includes(i.id) && (!q || fold(i.name).includes(q) || fold(i.nameLocal).includes(q)) && (!course || isWithin(i.categoryId, course)))
    .slice(0, q || course ? 40 : 0);
  const courseOf = (i: MenuItem) => pkg.rules.find((r) => lineage(i.categoryId).includes(r.categoryId));
  const chosen = ids.map((id) => items.find((i) => i.id === id)).filter((i): i is MenuItem => !!i);

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <p className="text-sm font-medium">Package suggestions</p>
        <p className="text-xs text-text-muted">Pick dishes to show as ideas for each package. On the public menu a visitor taps a package and sees what it covers and these dishes with their photos. Bookings and prices are not affected.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Package">
          <Select value={pkg.id} onChange={(e) => { setPkgId(e.target.value); setQuery(""); setCourse(""); }}>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}{p.publicSuggestions?.length ? ` · ${p.publicSuggestions.length} suggested` : ""}</option>)}</Select>
        </Field>
        <Field label="Course" hint={pkg.rules.length ? undefined : "This package has no courses set; search all dishes."}>
          <Select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">All dishes</option>
            {pkg.rules.map((r) => <option key={r.categoryId} value={r.categoryId}>{courseName(r.categoryId)} · choose {r.choose}</option>)}
          </Select>
        </Field>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
        <Input className="pl-9" placeholder={course ? `Search ${courseName(course)}, or leave empty to list them` : "Search a dish to suggest"} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search a dish to suggest" />
      </div>
      {(q || course) && (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border">
          {results.length === 0 && <li className="p-3 text-sm text-text-muted">No dish matches, or it is already suggested.</li>}
          {results.map((i) => (
            <li key={i.id} className="flex items-center gap-3 p-2">
              <DishImage item={i} sizes="40px" className="w-10 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium" data-no-title-case>{i.name}</span><span className="block truncate text-xs text-text-muted">{courseName(i.categoryId)}{!i.photo ? " · no photo yet" : ""}</span></span>
              <Button className="!h-8" onClick={() => add(i)} aria-label={`Suggest ${i.name}`}><Plus strokeWidth={1.75} />Add</Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="mb-2 text-xs font-medium text-text-muted">Suggested for {pkg.name} · {chosen.length}</p>
        {chosen.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-center text-sm text-text-muted">No dishes suggested yet. Pick a course above and add a few with good photos.</p> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {chosen.map((i, at) => (
              <li key={i.id} className={cn("overflow-hidden rounded-xl border bg-surface")}>
                <DishImage item={i} sizes="200px" className="w-full" />
                <div className="flex items-start gap-1 p-2">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium" data-no-title-case>{i.name}</span><span className="block truncate text-xs text-text-muted">{courseOf(i) ? courseName(courseOf(i)!.categoryId) : courseName(i.categoryId)}</span></span>
                  <span className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label={`Move ${i.name} earlier`} disabled={at === 0} onClick={() => move(at, -1)}><ArrowUp strokeWidth={1.75} /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Move ${i.name} later`} disabled={at === chosen.length - 1} onClick={() => move(at, 1)}><ArrowDown strokeWidth={1.75} /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${i.name}`} onClick={() => { save(ids.filter((x) => x !== i.id)); toast.success(`${i.name} removed from the suggestions`); }}><X strokeWidth={1.75} /></Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

