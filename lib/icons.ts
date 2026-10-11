import { Candy, CookingPot, Flame, GlassWater, IceCreamCone, Salad, Soup, Utensils, Wheat, type LucideIcon } from "lucide-react";

const map: Record<string, LucideIcon> = { Candy, CookingPot, Flame, GlassWater, IceCreamCone, Salad, Soup, Utensils, Wheat };

export function categoryIcon(name?: string): LucideIcon {
  return (name && map[name]) || Utensils;
}

export const categoryIconNames = Object.keys(map);

/** Neutral blurred placeholder shown while a dish photo loads. */
export const BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA0IDMnPjxyZWN0IHdpZHRoPSc0JyBoZWlnaHQ9JzMnIGZpbGw9JyNlN2RmZDMnLz48L3N2Zz4=";
