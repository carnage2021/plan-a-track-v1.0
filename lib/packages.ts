import type { MenuCategory, MenuPackage, PackageAddition } from "./types";

// How a package reads wherever it is shown: "Choose 2 starters", then its special additions.

export const ruleLine = (choose: number, categoryName: string) => `Choose ${choose} ${categoryName.toLowerCase()}`;

/** "2 Farsan", or just "Paan counter" when it is not counted. */
export const additionLine = (a: Pick<PackageAddition, "name" | "count">) => (a.count > 0 ? `${a.count} ${a.name}` : a.name);

/** Every line of a package in order: the choices, then the additions. */
export function packageLines(pkg: MenuPackage, categories: MenuCategory[]) {
  return [
    ...pkg.rules.map((r) => ruleLine(r.choose, categories.find((c) => c.id === r.categoryId)?.name ?? "dishes")),
    ...(pkg.additions ?? []).filter((a) => a.name.trim()).map(additionLine),
  ];
}

/** Packages still on offer; archived ones stay loaded only so older quotations keep their price. */
export const offered = (packages: MenuPackage[]) => packages.filter((p) => !p.archived);
