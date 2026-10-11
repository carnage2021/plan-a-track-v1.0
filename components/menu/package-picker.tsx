"use client";

import { Check, Scale, Users } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/shared/badges";
import { DishImage } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import type { MenuPackage } from "@/lib/types";
import { cn, money } from "@/lib/utils";

/** Four cover photos for a package: the best-known dish from its first categories. */
export function PackageCollage({ pkg, className }: { pkg: MenuPackage; className?: string }) {
  const items = useStore((s) => s.items);
  const picks = React.useMemo(() => {
    const withPhoto = items.filter((i) => i.active && i.photo);
    const fromRules = pkg.rules.map((r) => withPhoto.find((i) => i.categoryId === r.categoryId && i.bestseller) ?? withPhoto.find((i) => i.categoryId === r.categoryId));
    return [...new Set(fromRules.filter((i) => !!i))].slice(0, 4);
  }, [items, pkg]);
  return (
    <div className={cn("grid grid-cols-2 gap-1 overflow-hidden rounded-2xl", className)}>
      {picks.map((i) => <DishImage key={i!.id} item={i!} className="rounded-none" sizes="200px" />)}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string;
  pax: number;
  onPick: (packageId?: string) => void;
}

export function PackagePicker({ open, onOpenChange, value, pax, onPick }: Props) {
  const packages = useStore((s) => s.packages);
  const categories = useStore((s) => s.categories);
  const [compare, setCompare] = React.useState<string[]>([]);
  const pair = compare.map((id) => packages.find((p) => p.id === id)).filter((p): p is MenuPackage => !!p);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));
  const pick = (id?: string) => {
    onPick(id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Choose a package" description="Pick a ready package, or build the menu dish by dish." wide>
      {pair.length === 2 && (
        <div className="mb-4 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs text-text-muted">
              <tr><th className="px-3 py-2 font-medium">Compare</th>{pair.map((p) => <th key={p.id} className="px-3 py-2 font-medium">{p.name}</th>)}</tr>
            </thead>
            <tbody className="tnum divide-y">
              <tr><td className="px-3 py-2 text-text-muted">Per plate</td>{pair.map((p) => <td key={p.id} className="px-3 py-2 font-semibold">{money(p.pricePerPlate)}</td>)}</tr>
              <tr><td className="px-3 py-2 text-text-muted">Minimum guests</td>{pair.map((p) => <td key={p.id} className="px-3 py-2">{p.minPax}</td>)}</tr>
              {categories.filter((c) => pair.some((p) => p.rules.some((r) => r.categoryId === c.id))).map((c) => {
                const counts = pair.map((p) => p.rules.find((r) => r.categoryId === c.id)?.choose ?? 0);
                const differs = counts[0] !== counts[1];
                return (
                  <tr key={c.id} className={cn(differs && "bg-primary-soft")}>
                    <td className="px-3 py-2 text-text-muted">{c.name}</td>
                    {counts.map((n, i) => <td key={i} className={cn("px-3 py-2", differs && n === Math.max(...counts) && "font-semibold text-primary")}>{n ? `Any ${n}` : "Not included"}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {packages.map((p) => {
          const selected = value === p.id;
          return (
            <article key={p.id} className={cn("flex flex-col rounded-2xl border p-2 transition-colors duration-150", selected ? "border-primary bg-primary-soft" : "bg-surface")}>
              <div className="relative">
                <PackageCollage pkg={p} />
                {p.tier === "premium" && <Badge tone="gold" className="absolute left-2 top-2 bg-surface">Premium</Badge>}
              </div>
              <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-heading text-lg font-semibold">{p.name}</h3>
                  <p className="tnum text-sm"><span className="font-heading text-lg font-bold">{money(p.pricePerPlate)}</span> per plate</p>
                </div>
                <p className="mt-1 text-sm text-text-muted">{p.description}</p>
                <p className={cn("tnum mt-2 flex items-center gap-1.5 text-xs", pax < p.minPax ? "text-warning" : "text-text-muted")}>
                  <Users className="size-3.5" strokeWidth={1.75} />Minimum {p.minPax} guests{pax < p.minPax ? ` (this function has ${pax})` : ""}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1">
                  {p.rules.map((r) => <li key={r.categoryId}><Badge>{r.choose} {catName(r.categoryId).toLowerCase()}</Badge></li>)}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" variant={selected ? "primary" : "secondary"} onClick={() => pick(p.id)}>
                    {selected && <Check strokeWidth={2} />}{selected ? "Selected" : `Choose ${p.name}`}
                  </Button>
                  <Button variant="ghost" aria-pressed={compare.includes(p.id)} className={cn(compare.includes(p.id) && "bg-surface-muted text-primary")} onClick={() => toggleCompare(p.id)}>
                    <Scale strokeWidth={1.75} />Compare
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
        <button type="button" onClick={() => pick(undefined)} className={cn("flex min-h-32 flex-col items-start justify-center rounded-2xl border border-dashed p-4 text-left transition-colors duration-150 hover:border-primary", !value && "border-primary bg-primary-soft")}>
          <span className="font-heading text-lg font-semibold">Custom menu</span>
          <span className="mt-1 text-sm text-text-muted">No package. Every dish adds its own per-plate price.</span>
        </button>
      </div>
    </Sheet>
  );
}
