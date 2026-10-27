import type { PaymentMode } from "./types";

export type Section = "grocery" | "vegetables" | "dairy" | "dry_fruits" | "other";

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  section: Section;
  reorderLevel: number;
  lastRate: number;
  location: string;
  expiresOn?: string;
}

/** Quantity of one ingredient for the dish's base guest count (MenuItem.recipeBase). */
export interface RecipeLine {
  itemId: string;
  ingredientId: string;
  qty: number;
}

export interface StoreLocation {
  id: string;
  name: string;
}

export type MovementType = "opening" | "purchase" | "issue" | "return" | "wastage" | "adjustment" | "transfer";

/** Signed: positive adds to the store, negative takes out. Stock is the sum of movements. */
export interface Movement {
  id: string;
  ingredientId: string;
  storeId: string;
  type: MovementType;
  qty: number;
  rate?: number;
  note: string;
  orderId?: string;
  poId?: string;
  at: string;
}

export type VendorType = "raw_material" | "food_agency" | "rental" | "transport" | "labour" | "decor" | "hospitality";

export interface Vendor {
  id: string;
  name: string;
  type: VendorType;
  phone: string;
  gstin: string;
  terms: string;
  rating: number;
  notes: string;
}

export interface VendorRate {
  vendorId: string;
  ingredientId: string;
  rate: number;
}

export interface PoLine {
  id: string;
  ingredientId: string;
  qty: number;
  rate: number;
  /** Null until goods are received */
  receivedQty: number | null;
  receivedRate: number | null;
  deliverOn?: string;
  deliverTime: string;
  deliverPlace: string;
}

export type PoStatus = "draft" | "sent" | "partial" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  number: string;
  vendorId: string;
  orderId?: string;
  status: PoStatus;
  expectedOn: string;
  deliverTime: string;
  deliverPlace: string;
  notes: string;
  lines: PoLine[];
  createdAt: string;
}

export interface VendorBill {
  id: string;
  vendorId: string;
  poId?: string;
  outsourceId?: string;
  billNo: string;
  date: string;
  amount: number;
  note: string;
}

export interface VendorPayment {
  id: string;
  vendorId: string;
  amount: number;
  mode: PaymentMode;
  date: string;
  note: string;
}

export interface OutsourceLine {
  id: string;
  itemId: string;
  /** Guests (plates) for per-plate dishes, 1 for counters */
  qty: number;
  agencyRate: number;
  clientRate: number;
}

export type OutsourceStatus = "draft" | "sent" | "accepted" | "preparing" | "dispatched" | "delivered" | "cancelled";

export interface OutsourceOrder {
  id: string;
  number: string;
  orderId: string;
  functionId: string;
  vendorId: string;
  status: OutsourceStatus;
  deliverOn: string;
  deliverTime: string;
  deliverPlace: string;
  contact: string;
  notes: string;
  onTime?: boolean;
  issue?: string;
  lines: OutsourceLine[];
}

export type RuleBasis = "per_guest" | "per_dish" | "per_function" | "manual";

export interface Asset {
  id: string;
  name: string;
  category: string;
  totalQty: number;
  replacementCost: number;
  /** What the client is charged per piece for one event */
  rentRate?: number;
  location: string;
  ruleBasis: RuleBasis;
  ruleValue: number;
  /** For per_dish rules: count only dishes of this menu category */
  ruleCategoryId?: string;
}

export interface ChallanLine {
  id: string;
  assetId: string;
  required: number;
  issued: number;
  returned: number;
  broken: number;
  missing: number;
  rentedQty: number;
  rentalVendorId?: string;
  rentalCost: number;
  rentalDue?: string;
  deliverTime: string;
  deliverPlace: string;
}

export type ChallanStatus = "draft" | "issued" | "returned";

export interface Challan {
  id: string;
  number: string;
  orderId: string;
  functionId: string;
  status: ChallanStatus;
  vehicle: string;
  note: string;
  breakageCharged: boolean;
  lines: ChallanLine[];
}

export const sections: { id: Section; label: string }[] = [
  { id: "grocery", label: "Grocery" },
  { id: "vegetables", label: "Vegetables" },
  { id: "dairy", label: "Dairy" },
  { id: "dry_fruits", label: "Dry fruits" },
  { id: "other", label: "Other" },
];

export const vendorTypes: { id: VendorType; label: string }[] = [
  { id: "raw_material", label: "Raw material" },
  { id: "food_agency", label: "Third-party food" },
  { id: "rental", label: "Rental" },
  { id: "transport", label: "Transport" },
  { id: "labour", label: "Labour contractor" },
  { id: "decor", label: "Decor" },
  { id: "hospitality", label: "PRO / hospitality" },
];

export const units = ["kg", "g", "l", "ml", "pcs", "dozen", "packet", "bunch"];
