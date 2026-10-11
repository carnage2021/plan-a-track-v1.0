export type Role = "owner" | "sales" | "operations" | "kitchen" | "store" | "accountant";
export type Locale = "en" | "hi" | "gu";
export type Diet = "veg" | "jain" | "nonveg";
export type PricingType = "plate" | "counter" | "flat";

export interface Tenant {
  name: string;
  tagline: string;
  city: string;
  phone: string;
  email: string;
  address: string;
  brandColor: string;
  logo?: string;
  gstin: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  upiId: string;
  quotePrefix: string;
  orderPrefix: string;
  invoicePrefix: string;
  terms: string;
  gstRate: number;
  gstInclusive: boolean;
  /** Discount above this percentage needs owner approval */
  discountApprovalPct: number;
  /** Guests the kitchen can serve in one day */
  dailyCapacityPax: number;
  /** Per-plate discount by guest count; the last slab has no upper limit */
  slabs: { upTo?: number; pct: number }[];
}

export interface TeamUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  invited?: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  type: "retail" | "corporate" | "agency";
  tags: ("repeat" | "vip")[];
  language: Locale;
}

export type EnquiryStage = "new" | "contacted" | "quoted" | "followup" | "booked" | "lost";
export type LeadSource = "website" | "whatsapp" | "phone" | "walkin" | "referral";

export interface Enquiry {
  id: string;
  clientId: string;
  eventType: string;
  date: string;
  venue: string;
  pax: number;
  budgetPerPlate: number;
  foodPref: Diet;
  notes: string;
  source: LeadSource;
  stage: EnquiryStage;
  assignedTo: string;
  followUpAt?: string;
  lostReason?: string;
  createdAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
}

export interface MenuItem {
  id: string;
  name: string;
  nameLocal: string;
  categoryId: string;
  diet: Diet;
  cuisine: string;
  spice: 0 | 1 | 2 | 3;
  unit: "plate" | "kg" | "piece" | "glass";
  pricingType: PricingType;
  cost: number;
  price: number;
  photo?: string;
  description: string;
  active: boolean;
  outsourced: boolean;
  seasonal: boolean;
  bestseller: boolean;
}

export interface PackageRule {
  categoryId: string;
  choose: number;
}

export interface MenuPackage {
  id: string;
  name: string;
  tier: "silver" | "gold" | "premium" | "custom";
  pricePerPlate: number;
  minPax: number;
  fixedItemIds: string[];
  rules: PackageRule[];
  description: string;
}

export interface EventFunction {
  id: string;
  name: string;
  date: string;
  time: string;
  venue: string;
  pax: number;
  packageId?: string;
  itemIds: string[];
  /** Per-dish notes for this function, keyed by item id */
  itemNotes?: Record<string, string>;
}

export interface ExtraCharge {
  id: string;
  label: string;
  amount: number;
}

export interface Discount {
  type: "amount" | "percent";
  value: number;
}

export type QuoteStatus = "draft" | "pending_approval" | "sent" | "approved" | "changes" | "rejected" | "superseded";

export interface Quotation {
  id: string;
  number: string;
  /** Shared by every version of the same quotation */
  groupId: string;
  version: number;
  clientId: string;
  enquiryId?: string;
  eventType: string;
  functions: EventFunction[];
  extras: ExtraCharge[];
  discount: Discount;
  gstRate: number;
  gstInclusive: boolean;
  status: QuoteStatus;
  validUntil: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export type OrderStatus = "tentative" | "confirmed" | "in_progress" | "completed" | "cancelled";
export type PaymentMode = "cash" | "upi" | "bank" | "cheque" | "online";

export interface Payment {
  id: string;
  amount: number;
  mode: PaymentMode;
  date: string;
  note?: string;
  receiptNo: string;
}

export interface ChangeLogEntry {
  id: string;
  at: string;
  by: string;
  text: string;
  priceImpact: number;
}

export interface Order {
  id: string;
  number: string;
  quotationId?: string;
  clientId: string;
  eventType: string;
  functions: EventFunction[];
  extras: ExtraCharge[];
  discount: Discount;
  gstRate: number;
  gstInclusive: boolean;
  status: OrderStatus;
  payments: Payment[];
  changeLog: ChangeLogEntry[];
  instructions: string;
  managerId: string;
  cancelNote?: string;
  createdAt: string;
}

/** Work in progress in the quotation builder or booking mode */
export interface QuoteDraft {
  clientId?: string;
  clientName: string;
  clientPhone: string;
  enquiryId?: string;
  reviseOf?: string;
  eventType: string;
  functions: EventFunction[];
  extras: ExtraCharge[];
  discount: Discount;
  step: number;
  savedAt?: string;
}
