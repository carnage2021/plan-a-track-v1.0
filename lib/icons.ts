import {
  Apple, Banana, Cake, CakeSlice, Candy, Carrot, ChefHat, Cherry, Citrus, Coffee, Cookie, CookingPot, Croissant, CupSoda, Dessert, Donut, Drumstick, Egg, Fish, Flame, Gift,
  GlassWater, Grape, IceCreamBowl, IceCreamCone, Leaf, Milk, Pizza, Popcorn, Salad, Sandwich, Soup, Sparkles, Sprout, Utensils, Wheat, type LucideIcon,
} from "lucide-react";

// Icons a menu category can have, in the order the category editor offers them: drinks, savoury, breads,
// sweets, fruit and veg, the rest.
const map: Record<string, LucideIcon> = {
  GlassWater, CupSoda, Coffee, Milk, Salad, Flame, CookingPot, Soup, Popcorn, Sandwich, Pizza, Wheat, Croissant, Candy, IceCreamCone, IceCreamBowl, CakeSlice, Cake, Cookie, Donut, Dessert,
  Apple, Banana, Cherry, Citrus, Grape, Carrot, Leaf, Sprout, Egg, Fish, Drumstick, ChefHat, Sparkles, Gift, Utensils,
};

export function categoryIcon(name?: string): LucideIcon {
  return (name && map[name]) || Utensils;
}

export const categoryIconNames = Object.keys(map);

/** Neutral blurred placeholder shown while a dish photo loads. */
export const BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA0IDMnPjxyZWN0IHdpZHRoPSc0JyBoZWlnaHQ9JzMnIGZpbGw9JyNlN2RmZDMnLz48L3N2Zz4=";
