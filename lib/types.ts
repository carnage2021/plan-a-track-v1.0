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
  /** Document design; absent until 0008_expenses_documents.sql has been run */
  docs?: DocSettings;
  /** Address of the public menu page, /m/<slug> */
  publicSlug?: string;
  publicMenu?: boolean;
  publicPrices?: boolean;
  /** Role access and approval limits; absent until 0009 has been run */
  access?: import("./access").TenantAccess;
  /** The platform subscription, set by the platform team; absent until 0010 has been run */
  subscription?: Subscription;
  /** The owner's food types; absent until 0012 has been run or until the owner first edits them */
  foodTypes?: FoodType[];
  /** The referral offer; absent until 0014 has been run */
  referral?: ReferralSettings;
  /** What the client is charged per event for each staff role; absent until 0018 has been run */
  staffRates?: StaffRate[];
}

/** A photo shown to the client while choosing extras: a staff uniform, a cutlery item or a decoration setup. */
export interface SamplePhoto { id: string; kind: "staff" | "cutlery" | "decor"; name: string; photoUrl: string; note: string }

/** A staff role and what one person in it is charged to the client for one event. */
export interface StaffRate { name: string; rate: number }

/** A charge on one event: service staff by role, cutlery by the piece, or anything else. */
export interface EventCharge {
  id: string;
  kind: "worker" | "cutlery" | "other";
  /** The staff role name or the cutlery item id it came from */
  ref?: string;
  label: string;
  qty: number;
  rate: number;
}

export interface ReferralSettings {
  enabled: boolean;
  /** What the new customer gets off their quotation */
  type: "percent" | "amount";
  value: number;
  /** Most a percent discount can come to, in rupees; 0 for no limit */
  max: number;
  /** Credit the referring client earns once the new booking is confirmed */
  reward: number;
}

/** A kind of catering service, such as Welcome Drinks or Gala Dinner, and the menu categories it offers. */
export interface FoodType {
  id: string;
  name: string;
  categoryIds: string[];
}

export type Session = "morning" | "afternoon" | "evening" | "night";

export interface Subscription {
  status: "trial" | "active" | "overdue" | "suspended";
  planId?: string;
  trialEndsAt?: string;
  paidUntil?: string;
  cycle: "monthly" | "annual";
  addons: string[];
  extraUsers: number;
}

export type DocTheme = "classic" | "minimal" | "royal" | "festive" | "modern" | "mono";
export interface DocSettings {
  theme: DocTheme;
  /** Printed above the terms on every document */
  footer: string;
  showBank: boolean;
  showUpiQr: boolean;
  /** Storage path of the authorised signatory's signature */
  signaturePath?: string;
}

export interface Coordinator { name: string; phone: string; email: string }

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
  /** ISO dates; the year is ignored for greetings */
  birthday?: string;
  anniversary?: string;
  /** A second phone number; absent until 0016 has been run */
  altPhone?: string;
  /** The code this client shares with friends; absent until 0014 has been run */
  referralCode?: string;
  /** The client whose code brought this one in */
  referredBy?: string;
  /** Referral credit to spend on a later booking, in rupees */
  credit?: number;
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
  /** Last day of a multi-day event; `date` is the first */
  endDate?: string;
  /** The catering services asked for, each with its own date, food type and timings */
  services?: EventFunction[];
  /** Team member coordinating with the client; follows the enquiry into its quotation and booking */
  coordinatorId?: string;
  /** The coordinator's name, phone and email as typed (or filled from the team) */
  coordinator?: Coordinator;
}

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
  /** The category this one sits inside; unset for a top-level category */
  parentId?: string;
  /** Main course: its dishes have no price; the rate per plate is typed in at booking. Sub-categories follow it. */
  atBooking?: boolean;
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
  /** Guests the recipe is written for */
  recipeBase: number;
  /** Wastage buffer added when the recipe is scaled, in percent */
  bufferPct: number;
  /** Third-party agency that makes an outsourced dish, and what they charge per unit */
  agencyId?: string;
  agencyRate: number;
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
  /** Offered only for this food type; unset means every food type */
  foodTypeId?: string;
  /** Extra lines the package includes beyond the dish choices, e.g. "Paan counter" or 2 "Farsan" */
  additions?: PackageAddition[];
  /** Removed from offer but kept, because quotations or orders use it */
  archived?: boolean;
}

export interface PackageAddition {
  id: string;
  name: string;
  /** How many, when it is counted; 0 for a single item or counter */
  count: number;
}

export interface EventFunction {
  id: string;
  name: string;
  date: string;
  /** Start time, HH:MM */
  time: string;
  /** End time, HH:MM; may be after midnight */
  endTime?: string;
  session?: Session;
  foodTypeId?: string;
  venue: string;
  pax: number;
  packageId?: string;
  itemIds: string[];
  /** Per-dish notes for this function, keyed by item id */
  itemNotes?: Record<string, string>;
  /** Per-plate prices changed for this quotation or order only, keyed by item id */
  itemPrices?: Record<string, number>;
  /** Staff, cutlery and other charges on this event alone */
  charges?: EventCharge[];
  /** Main course rate per plate, typed in at booking for the dishes priced there */
  mainRate?: number;
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
  /** Referral code the client came in with */
  referralCode?: string;
  /** Referral credit taken off this quotation, in rupees */
  creditUsed?: number;
  coordinatorId?: string;
  /** The coordinator's name, phone and email as typed (or filled from the team) */
  coordinator?: Coordinator;
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
  /** Commission owed to a partner agency that booked us, in percent */
  commissionPct: number;
  cancelNote?: string;
  createdAt: string;
  referralCode?: string;
  creditUsed?: number;
  /** True once the referring client has been credited for this booking */
  referralRewarded?: boolean;
  /** Raw material changed by hand for this event: ingredient id to quantity; 0 removes it */
  rawOverrides?: Record<string, number>;
  /** Team member coordinating the event with the client */
  coordinatorId?: string;
  /** The coordinator's name, phone and email as typed (or filled from the team) */
  coordinator?: Coordinator;
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
  referralCode?: string;
  creditUsed?: number;
  /** Client contact details, saved to the client */
  clientEmail?: string;
  clientAltPhone?: string;
  clientAddress?: string;
  coordinatorId?: string;
  /** The coordinator's name, phone and email as typed (or filled from the team) */
  coordinator?: Coordinator;
}
