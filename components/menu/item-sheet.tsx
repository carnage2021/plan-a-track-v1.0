"use client";

import { Camera, Plus, Trash2, Upload } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { DishImage } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { marginTone } from "@/lib/pricing";
import { treeOrder } from "@/lib/categories";
import { CategoryPicker } from "./category-picker";
import { useFoodTypes } from "@/lib/services";
import { AgencyFields, RecipeEditor } from "@/components/supply/recipe";
import { useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import type { MenuItem, MenuPackage, PackageAddition } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { useAccess } from "@/lib/access";

/** Centre-crops to 4:3 and compresses to WebP at 800 x 600, in the browser. */
async function cropToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = 4 / 3;
  const sw = bitmap.width / bitmap.height > ratio ? bitmap.height * ratio : bitmap.width;
  const sh = sw / ratio;
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, 800, 600);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not compress the image"))), "image/webp", 0.8));
}

const blank: Omit<MenuItem, "id"> = {
  name: "", nameLocal: "", categoryId: "", diet: "veg", cuisine: "Gujarati", spice: 1, unit: "plate", pricingType: "plate",
  cost: 0, price: 0, description: "", active: true, outsourced: false, seasonal: false, bestseller: false, recipeBase: 100, bufferPct: 5, agencyRate: 0,
};

interface ItemSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item?: MenuItem;
  categoryId?: string;
}

/** Remounts each time it opens so the form always starts from the dish being edited. */
export function ItemSheet(props: ItemSheetProps) {
  return <ItemSheetForm key={`${props.open}-${props.item?.id ?? "new"}`} {...props} />;
}

function ItemSheetForm({ open, onOpenChange, item, categoryId }: ItemSheetProps) {
  const categories = useStore((s) => s.categories);
  const saveItem = useStore((s) => s.saveItem);
  const [form, setForm] = React.useState<Omit<MenuItem, "id">>(() => (item ? { ...item } : { ...blank, categoryId: categoryId && categoryId !== "all" ? categoryId : (categories[0]?.id ?? "") }));
  const supplyReady = useSupply((s) => s.ready);
  const [touched, setTouched] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const uploadMedia = useStore((s) => s.uploadMedia);
  const file = React.useRef<HTMLInputElement>(null);
  const camera = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const margin = form.price ? ((form.price - form.cost) / form.price) * 100 : 0;
  const { hidePrices } = useAccess();
  const errors = { name: form.name.trim() ? "" : "Give the dish a name", price: form.price > 0 ? "" : "Enter the selling price" };

  const addPhoto = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error("That file is not an image");
    try {
      setUploading(true);
      set("photo", await uploadMedia(await cropToWebp(f), "dish.webp"));
    } catch (e) {
      toast.error("The photo was not uploaded", { description: e instanceof Error ? e.message : "Try a JPG or PNG." });
    } finally {
      setUploading(false);
    }
  };
  const save = () => {
    setTouched(true);
    if (errors.name || errors.price) return;
    // The recipe editor saves on its own and sets the food cost, so keep what it wrote.
    const latest = useStore.getState().items.find((i) => i.id === item?.id);
    const fromRecipe = latest && useSupply.getState().recipes.some((r) => r.itemId === latest.id) ? { cost: latest.cost, recipeBase: latest.recipeBase, bufferPct: latest.bufferPct } : {};
    saveItem({ ...form, ...fromRecipe, name: form.name.trim(), id: item?.id });
    onOpenChange(false);
    toast.success(item ? "Dish updated" : "Dish added to the menu");
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit dish" : "Add dish"}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save dish</Button></>}
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void addPhoto(e.dataTransfer.files[0]); }}
          className={cn("rounded-2xl border-2 border-dashed p-2 transition-colors duration-150", over ? "border-primary bg-primary-soft" : "border-border")}
        >
          <DishImage item={{ photo: form.photo, name: form.name, categoryId: form.categoryId }} sizes="420px" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input ref={file} type="file" accept="image/*" className="sr-only" onChange={(e) => void addPhoto(e.target.files?.[0])} />
            <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void addPhoto(e.target.files?.[0])} />
            <Button loading={uploading} onClick={() => file.current?.click()}><Upload strokeWidth={1.75} />{form.photo ? "Replace photo" : "Upload photo"}</Button>
            <Button variant="ghost" className="md:hidden" onClick={() => camera.current?.click()}><Camera strokeWidth={1.75} />Camera</Button>
            {form.photo && <Button variant="ghost" size="icon" aria-label="Remove photo" onClick={() => set("photo", undefined)}><Trash2 strokeWidth={1.75} /></Button>}
            <span className="text-xs text-text-muted max-md:hidden">or drop an image here. It is cropped to 4:3.</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Dish name" error={touched ? errors.name : ""} className="col-span-2"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Paneer Tikka" /></Field>
          <Field label="Name in Gujarati or Hindi" className="col-span-2"><Input value={form.nameLocal} onChange={(e) => set("nameLocal", e.target.value)} placeholder="પનીર ટિક્કા" /></Field>
          <CategoryPicker value={form.categoryId} onChange={(id) => set("categoryId", id)} canAdd />
          <Field label="Food type">
            <Select value={form.diet} onChange={(e) => set("diet", e.target.value as MenuItem["diet"])}><option value="veg">Veg</option><option value="jain">Jain / Swaminarayan</option><option value="nonveg">Non-veg</option></Select>
          </Field>
          <Field label="Cuisine"><Input value={form.cuisine} onChange={(e) => set("cuisine", e.target.value)} /></Field>
          <Field label="Spice level">
            <Select value={form.spice} onChange={(e) => set("spice", Number(e.target.value) as MenuItem["spice"])}>{["Not spicy", "Mild", "Medium", "Spicy"].map((s, i) => <option key={s} value={i}>{s}</option>)}</Select>
          </Field>
          <Field label="Priced">
            <Select value={form.pricingType} onChange={(e) => set("pricingType", e.target.value as MenuItem["pricingType"])}><option value="plate">Per plate</option><option value="counter">Per counter</option><option value="flat">Flat amount</option></Select>
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={(e) => set("unit", e.target.value as MenuItem["unit"])}>{["plate", "glass", "piece", "kg"].map((u) => <option key={u}>{u}</option>)}</Select>
          </Field>
          {!hidePrices && <Field label="Cost price"><MoneyInput value={form.cost} onChange={(v) => set("cost", v)} /></Field>}
          {!hidePrices && <Field label="Selling price" error={touched ? errors.price : ""}><MoneyInput value={form.price} onChange={(v) => set("price", v)} /></Field>}
        </div>
        {form.price > 0 && !hidePrices && <p className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-muted">Margin on this dish<Badge tone={marginTone(margin)}>{Math.round(margin)}%</Badge></p>}
        <Field label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="How it is made and served" /></Field>
        <div className="divide-y rounded-xl border">
          {([["active", "Available on the menu", "Switch off to hide it from new quotations."], ["bestseller", "Bestseller", "Shown with a gold tag."], ["seasonal", "Seasonal", "Only available part of the year."], ["outsourced", "Outsourced", "Made by a third-party vendor, not in-house."]] as const).map(([key, label, help]) => (
            <div key={key} className="flex items-center justify-between gap-3 p-3">
              <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-text-muted">{help}</p></div>
              <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} label={label} />
            </div>
          ))}
        </div>
        {supplyReady && form.outsourced && <AgencyFields agencyId={form.agencyId} agencyRate={form.agencyRate} onChange={(patch) => setForm((f) => ({ ...f, ...patch, ...(patch.agencyRate !== undefined ? { cost: patch.agencyRate } : {}) }))} />}
        {supplyReady && item && !form.outsourced && <RecipeEditor item={item} />}
        {supplyReady && !item && !form.outsourced && <p className="text-xs text-text-muted">Save the dish first, then open it again to add its recipe.</p>}
      </div>
    </Sheet>
  );
}

interface PackageSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pkg?: MenuPackage;
}

const freshPackage = (): Omit<MenuPackage, "id"> => ({ name: "", tier: "custom", pricePerPlate: 0, minPax: 100, fixedItemIds: [], rules: [], description: "", additions: [] });

export function PackageSheet(props: PackageSheetProps) {
  return <PackageSheetForm key={`${props.open}-${props.pkg?.id ?? "new"}`} {...props} />;
}

function PackageSheetForm({ open, onOpenChange, pkg }: PackageSheetProps) {
  const categories = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const savePackage = useStore((s) => s.savePackage);
  const removePackage = useStore((s) => s.removePackage);
  const extrasReady = useStore((s) => s.packageExtrasReady);
  const quotations = useStore((s) => s.quotations);
  const orders = useStore((s) => s.orders);
  const usedBy = pkg ? [...quotations, ...orders].filter((x) => x.functions.some((f) => f.packageId === pkg.id)).length : 0;
  const foodTypes = useFoodTypes();
  const [form, setForm] = React.useState<Omit<MenuPackage, "id">>(() => (pkg ? { ...pkg, additions: pkg.additions ?? [] } : freshPackage()));
  const [confirming, setConfirming] = React.useState(false);
  const additions = form.additions ?? [];
  const setAddition = (id: string, patch: Partial<PackageAddition>) => setForm((f) => ({ ...f, additions: (f.additions ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const remove = () => {
    const how = removePackage(pkg!.id);
    onOpenChange(false);
    toast.success(how === "deleted" ? `${pkg!.name} deleted` : `${pkg!.name} removed from offer`, { description: how === "archived" ? "Quotations and orders that use it keep their price." : undefined });
  };

  const count = (categoryId: string) => form.rules.find((r) => r.categoryId === categoryId)?.choose ?? 0;
  const setCount = (categoryId: string, choose: number) =>
    setForm((f) => ({ ...f, rules: categories.map((c) => ({ categoryId: c.id, choose: c.id === categoryId ? choose : (f.rules.find((r) => r.categoryId === c.id)?.choose ?? 0) })).filter((r) => r.choose > 0) }));
  const valid = form.name.trim() && form.pricePerPlate > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={pkg ? `Edit ${pkg.name}` : "New package"}
      description="How many dishes the client chooses in each category, dishes that are always included, and any special additions."
      footer={
        confirming ? (
          <>
            <span className="mr-auto text-sm text-text-muted">{usedBy ? `Used in ${usedBy} quotations or orders, so it is hidden rather than deleted.` : "This cannot be undone."}</span>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>
            <Button variant="danger" onClick={remove}>{usedBy ? "Remove from offer" : "Delete package"}</Button>
          </>
        ) : (
          <>
            {pkg && (usedBy === 0 || extrasReady) && <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirming(true)}><Trash2 strokeWidth={1.75} />Delete</Button>}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" disabled={!valid} onClick={() => { savePackage({ ...form, name: form.name.trim(), additions: additions.filter((a) => a.name.trim()), id: pkg?.id }); onOpenChange(false); toast.success("Package saved"); }}>Save package</Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Package name" className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Gold" /></Field>
          <Field label="Price per plate"><MoneyInput value={form.pricePerPlate} onChange={(v) => setForm({ ...form, pricePerPlate: v })} /></Field>
          <Field label="Minimum guests"><Input inputMode="numeric" className="tnum" value={form.minPax || ""} onChange={(e) => setForm({ ...form, minPax: Number(e.target.value.replace(/\D/g, "")) })} /></Field>
          <Field label="Food type" className="col-span-2" hint="The package is offered only for services of this food type.">
            <Select value={form.foodTypeId ?? ""} onChange={(e) => setForm({ ...form, foodTypeId: e.target.value || undefined })}>
              <option value="">Any food type</option>
              {foodTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Short description" className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">Client chooses</span>
          <span className="mb-2 block text-xs text-text-muted">Count a whole category (Main course 3) or a sub-category (Paneer sabji 1). A dish fills the most specific choice first.</span>
          <ul className="divide-y rounded-xl border">
            {treeOrder(categories).map(({ c, depth }) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 pr-3" style={{ paddingLeft: 12 + depth * 20 }}>
                <span className={depth ? "text-sm text-text-muted" : "text-sm font-medium"}>{depth ? "› " : ""}{c.name}</span>
                <span className="flex items-center gap-2 text-sm text-text-muted">
                  <Select aria-label={`Dishes from ${c.name}`} className="tnum !h-9 w-16" value={count(c.id)} onChange={(e) => setCount(c.id, Number(e.target.value))}>{[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</Select>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">Always included</span>
          <div className="flex flex-wrap gap-2">
            {form.fixedItemIds.map((id) => (
              <button key={id} type="button" onClick={() => setForm({ ...form, fixedItemIds: form.fixedItemIds.filter((x) => x !== id) })} className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-surface px-3 text-sm hover:border-danger hover:text-danger" title="Remove">
                {items.find((i) => i.id === id)?.name}<Trash2 className="size-3.5" strokeWidth={1.75} />
              </button>
            ))}
          </div>
          <Select aria-label="Add an always-included dish" className="mt-2" value="" onChange={(e) => e.target.value && setForm({ ...form, fixedItemIds: [...form.fixedItemIds, e.target.value] })}>
            <option value="">Add a dish that is always included</option>
            {items.filter((i) => i.active && i.pricingType === "plate" && !form.fixedItemIds.includes(i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
        </div>
        <div>
          <span className="block text-xs font-medium text-text-muted">Special additions</span>
          <span className="mb-2 block text-xs text-text-muted">Anything else the package includes, with a count when there is one: 2 Farsan, Paan counter, Mocktail bar.</span>
          {!extrasReady && <p className="mb-2 rounded-lg bg-warning/10 p-2 text-xs text-warning">Saved once the 0013 database update is run.</p>}
          <ul className="space-y-2">
            {additions.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <Input aria-label="Count" inputMode="numeric" className="tnum w-20 shrink-0 text-center" placeholder="No." value={a.count || ""} onChange={(e) => setAddition(a.id, { count: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                <Input aria-label="What it is" className="flex-1" placeholder="Farsan, Paan counter" value={a.name} onChange={(e) => setAddition(a.id, { name: e.target.value })} />
                <Button variant="ghost" size="icon" aria-label={`Remove ${a.name || "addition"}`} onClick={() => setForm((f) => ({ ...f, additions: (f.additions ?? []).filter((x) => x.id !== a.id) }))}><Trash2 strokeWidth={1.75} /></Button>
              </li>
            ))}
          </ul>
          <Button className="mt-2" onClick={() => setForm((f) => ({ ...f, additions: [...(f.additions ?? []), { id: uid(), name: "", count: 0 }] }))}><Plus strokeWidth={1.75} />Add special addition</Button>
        </div>
      </div>
    </Sheet>
  );
}
