"use client";

import { Check, Flame, Plus } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { mediaUrl } from "@/lib/db";
import { BLUR, categoryIcon } from "@/lib/icons";
import { useStore } from "@/lib/store";
import { pricedAtBooking } from "@/lib/categories";
import type { MenuItem } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { Badge, VegMark } from "./badges";

/** 4:3 dish photo. Dishes without a photo get their category illustration, never a broken image. */
export function DishImage({ item, sizes = "(max-width: 768px) 50vw, 320px", className, priority }: { item: Pick<MenuItem, "photo" | "name" | "categoryId">; sizes?: string; className?: string; priority?: boolean }) {
  const icon = useStore((s) => s.categories.find((c) => c.id === item.categoryId)?.icon);
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-muted", className)}>
      {item.photo ? (
        <Image src={mediaUrl(item.photo)!} alt={item.name} fill sizes={sizes} placeholder="blur" blurDataURL={BLUR} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-primary-soft">
          <div className="grid size-2/5 max-h-20 max-w-20 place-items-center rounded-full border border-accent-gold/40 text-accent-gold">
            {React.createElement(categoryIcon(icon), { className: "size-1/2", strokeWidth: 1.5 })}
          </div>
        </div>
      )}
    </div>
  );
}

export function priceLabel(item: Pick<MenuItem, "price" | "pricingType" | "unit"> & { categoryId?: string }) {
  if (item.categoryId && pricedAtBooking(item.categoryId)) return "Rate at booking";
  if (item.pricingType === "counter") return `${money(item.price)} per counter`;
  if (item.pricingType === "flat") return `${money(item.price)} flat`;
  return `${money(item.price)} per ${item.unit}`;
}

export function dishTag(item: MenuItem) {
  if (item.outsourced) return "Outsourced";
  if (item.seasonal) return "Seasonal";
  if (item.bestseller) return "Bestseller";
  return null;
}

interface DishCardProps {
  item: MenuItem;
  selected?: boolean;
  /** Extra line under the name */
  note?: string;
  /** Internal tags (Outsourced) are removed in booking mode, not just hidden */
  hideInternal?: boolean;
  large?: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
}

export function DishCard({ item, selected, note, hideInternal, large, onToggle, onOpen }: DishCardProps) {
  // Dishes are picked by name and photo; prices stay off the menu selection screen.
  const tag = hideInternal && item.outsourced ? (item.bestseller ? "Bestseller" : null) : dishTag(item);
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-surface p-2 transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:shadow-card",
        selected ? "border-primary bg-primary-soft" : "border-border",
        !item.active && "opacity-60",
      )}
    >
      <button type="button" onClick={onOpen} className="relative block rounded-2xl text-left" aria-label={`${item.name} details`}>
        <DishImage item={item} sizes={large ? "(max-width: 768px) 50vw, 420px" : undefined} />
        <span className="absolute left-2 top-2">
          <VegMark diet={item.diet} />
        </span>
        {tag && (
          <Badge tone={tag === "Bestseller" ? "gold" : "neutral"} className="absolute right-2 top-2 bg-surface/95 backdrop-blur-none">
            {tag}
          </Badge>
        )}
        {selected && (
          <span className="absolute bottom-2 left-2 grid size-7 place-items-center rounded-full bg-primary text-primary-fg">
            <Check className="size-4" strokeWidth={2.5} />
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        <h3 className={cn("truncate font-heading font-semibold", large ? "text-lg" : "text-base")}>{item.name}</h3>
        <p className="truncate text-xs text-text-muted">{item.nameLocal}</p>
        {note && <p className="tnum mt-1 text-xs text-warning">{note}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="tnum flex items-center gap-1.5 whitespace-nowrap text-sm">
            {item.spice >= 2 && <Flame className="size-3.5 shrink-0 text-danger" strokeWidth={1.75} aria-label="Spicy" />}
          </p>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "inline-flex h-9 min-w-20 flex-1 items-center justify-center gap-1 rounded-lg border bg-surface px-3 text-sm font-medium transition-colors duration-150 sm:flex-none",
                selected ? "border-primary text-primary" : "border-border text-text hover:border-primary hover:text-primary",
              )}
            >
              {selected ? "Remove" : (<><Plus className="size-4" strokeWidth={2} />Add</>)}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
