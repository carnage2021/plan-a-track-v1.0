import credits from "@/public/dishes/credits.json";
import type {
  Client,
  Enquiry,
  EventFunction,
  MenuCategory,
  MenuItem,
  MenuPackage,
  Order,
  Payment,
  Quotation,
  TeamUser,
  Tenant,
} from "./types";
import { addDays, financialYear, isoDate } from "./utils";

const photos = credits as Record<string, { file: string }>;

export const categories: MenuCategory[] = [
  { id: "beverages", name: "Welcome drinks", icon: "GlassWater" },
  { id: "starters", name: "Starters", icon: "Salad" },
  { id: "chaat", name: "Chaat and live counters", icon: "Flame" },
  { id: "mains", name: "Main course", icon: "CookingPot" },
  { id: "breads", name: "Breads", icon: "Wheat" },
  { id: "rice", name: "Rice", icon: "Soup" },
  { id: "sweets", name: "Sweets", icon: "Candy" },
  { id: "desserts", name: "Dessert counters", icon: "IceCreamCone" },
  { id: "sides", name: "Accompaniments", icon: "Utensils" },
];

// id, name, Gujarati name, category, diet, cuisine, spice, cost, price, flags
// flags: b bestseller, s seasonal, o outsourced, c priced per counter
type Row = [string, string, string, string, MenuItem["diet"], string, MenuItem["spice"], number, number, string?];

const rows: Row[] = [
  ["masala-chaas", "Masala Chaas", "મસાલા છાશ", "beverages", "jain", "Gujarati", 1, 6, 20, "b"],
  ["mango-lassi", "Mango Lassi", "મેંગો લસ્સી", "beverages", "jain", "Punjabi", 0, 16, 40, "s"],
  ["jaljeera", "Jaljeera", "જલજીરા", "beverages", "jain", "North Indian", 1, 5, 20],
  ["thandai", "Kesar Thandai", "કેસર ઠંડાઈ", "beverages", "jain", "North Indian", 0, 18, 45, "s"],
  ["masala-chai", "Masala Chai", "મસાલા ચા", "beverages", "jain", "Indian", 1, 6, 15],
  ["paneer-tikka", "Paneer Tikka", "પનીર ટિક્કા", "starters", "veg", "Punjabi", 2, 28, 65, "b"],
  ["hara-bhara-kabab", "Hara Bhara Kabab", "હરાભરા કબાબ", "starters", "veg", "North Indian", 1, 16, 45],
  ["samosa", "Punjabi Samosa", "પંજાબી સમોસા", "starters", "veg", "Punjabi", 2, 9, 30, "b"],
  ["dhokla", "Khaman Dhokla", "ખમણ ઢોકળા", "starters", "jain", "Gujarati", 1, 8, 30, "b"],
  ["khandvi", "Khandvi", "ખાંડવી", "starters", "jain", "Gujarati", 1, 10, 35],
  ["aloo-tikki", "Aloo Tikki", "આલુ ટિક્કી", "starters", "veg", "North Indian", 2, 10, 35],
  ["dahi-vada", "Dahi Vada", "દહીં વડા", "starters", "veg", "North Indian", 1, 12, 40],
  ["kachori", "Khasta Kachori", "ખસ્તા કચોરી", "starters", "veg", "Rajasthani", 2, 9, 30],
  ["spring-roll", "Veg Spring Roll", "વેજ સ્પ્રિંગ રોલ", "starters", "veg", "Indo-Chinese", 1, 14, 40],
  ["chicken-tikka", "Chicken Tikka", "ચિકન ટિક્કા", "starters", "nonveg", "Punjabi", 2, 42, 95],
  ["seekh-kebab", "Mutton Seekh Kebab", "સીખ કબાબ", "starters", "nonveg", "Mughlai", 3, 55, 120],
  ["pani-puri", "Pani Puri Counter", "પાણીપુરી", "chaat", "veg", "Chaat", 2, 12, 40, "b"],
  ["bhel-puri", "Bhel Puri", "ભેળપુરી", "chaat", "veg", "Chaat", 2, 10, 35],
  ["sev-puri", "Sev Puri", "સેવપુરી", "chaat", "veg", "Chaat", 2, 11, 35],
  ["pav-bhaji", "Pav Bhaji", "પાવભાજી", "chaat", "veg", "Mumbai", 2, 22, 60, "b"],
  ["masala-dosa", "Live Dosa Counter", "લાઈવ ઢોસા કાઉન્ટર", "chaat", "veg", "South Indian", 1, 9000, 18000, "c"],
  ["dabeli", "Kutchi Dabeli", "કચ્છી દાબેલી", "chaat", "veg", "Gujarati", 2, 10, 30],
  ["paneer-butter-masala", "Paneer Butter Masala", "પનીર બટર મસાલા", "mains", "veg", "Punjabi", 1, 34, 75, "b"],
  ["palak-paneer", "Palak Paneer", "પાલક પનીર", "mains", "veg", "Punjabi", 1, 30, 70],
  ["dal-makhani", "Dal Makhani", "દાલ મખની", "mains", "veg", "Punjabi", 1, 18, 50, "b"],
  ["undhiyu", "Surti Undhiyu", "સુરતી ઊંધિયું", "mains", "veg", "Gujarati", 2, 32, 80, "s"],
  ["chole", "Pindi Chole", "પિંડી છોલે", "mains", "veg", "Punjabi", 2, 16, 45],
  ["malai-kofta", "Malai Kofta", "મલાઈ કોફ્તા", "mains", "veg", "Mughlai", 1, 30, 70],
  ["aloo-gobi", "Aloo Gobi", "આલુ ગોબી", "mains", "veg", "North Indian", 2, 14, 40],
  ["gujarati-kadhi", "Gujarati Kadhi", "ગુજરાતી કઢી", "mains", "jain", "Gujarati", 1, 10, 35],
  ["dal-tadka", "Dal Tadka", "દાલ તડકા", "mains", "veg", "North Indian", 2, 12, 35],
  ["sev-tameta", "Sev Tameta nu Shaak", "સેવ ટામેટાનું શાક", "mains", "veg", "Gujarati", 2, 12, 40],
  ["butter-chicken", "Butter Chicken", "બટર ચિકન", "mains", "nonveg", "Punjabi", 2, 58, 130],
  ["naan", "Butter Naan", "બટર નાન", "breads", "veg", "Punjabi", 0, 7, 20, "b"],
  ["puri", "Puri", "પૂરી", "breads", "jain", "Gujarati", 0, 5, 15],
  ["phulka-roti", "Phulka Roti", "ફુલકા રોટલી", "breads", "jain", "Gujarati", 0, 4, 12],
  ["thepla", "Methi Thepla", "મેથી થેપલા", "breads", "veg", "Gujarati", 1, 6, 18],
  ["paratha", "Lachha Paratha", "લચ્છા પરાઠા", "breads", "veg", "Punjabi", 0, 8, 22],
  ["bhakri", "Biscuit Bhakri", "બિસ્કિટ ભાખરી", "breads", "jain", "Gujarati", 0, 5, 15],
  ["jeera-rice", "Jeera Rice", "જીરા રાઈસ", "rice", "jain", "North Indian", 0, 10, 30],
  ["veg-biryani", "Veg Dum Biryani", "વેજ દમ બિરયાની", "rice", "veg", "Hyderabadi", 2, 22, 55, "b"],
  ["veg-pulao", "Veg Pulao", "વેજ પુલાવ", "rice", "veg", "North Indian", 1, 14, 40],
  ["khichdi", "Vaghareli Khichdi", "વઘારેલી ખીચડી", "rice", "jain", "Gujarati", 1, 10, 30],
  ["gulab-jamun", "Gulab Jamun", "ગુલાબ જાંબુ", "sweets", "jain", "North Indian", 0, 12, 35, "b"],
  ["jalebi", "Kesar Jalebi", "કેસર જલેબી", "sweets", "jain", "North Indian", 0, 12, 35],
  ["rasmalai", "Rasmalai", "રસમલાઈ", "sweets", "jain", "Bengali", 0, 22, 55, "b"],
  ["shrikhand", "Kesar Shrikhand", "કેસર શ્રીખંડ", "sweets", "jain", "Gujarati", 0, 18, 45],
  ["kaju-katli", "Kaju Katli", "કાજુ કતરી", "sweets", "jain", "North Indian", 0, 30, 65],
  ["mohanthal", "Mohanthal", "મોહનથાળ", "sweets", "jain", "Gujarati", 0, 16, 40],
  ["gajar-halwa", "Gajar Halwa", "ગાજર હલવો", "sweets", "jain", "Punjabi", 0, 18, 45, "s"],
  ["basundi", "Basundi", "બાસુંદી", "sweets", "jain", "Gujarati", 0, 20, 50],
  ["rasgulla", "Rasgulla", "રસગુલ્લા", "sweets", "jain", "Bengali", 0, 12, 35],
  ["kulfi", "Matka Kulfi", "મટકા કુલ્ફી", "desserts", "jain", "North Indian", 0, 22, 40, "o"],
  ["ice-cream", "Ice Cream Counter", "આઈસ્ક્રીમ કાઉન્ટર", "desserts", "jain", "Dessert", 0, 20, 35, "o"],
  ["paan", "Meetha Paan", "મીઠું પાન", "desserts", "jain", "Indian", 0, 10, 20, "o"],
  ["falooda", "Rose Falooda", "રોઝ ફાલુદા", "desserts", "jain", "Mumbai", 0, 20, 45],
  ["papad", "Roasted Papad", "શેકેલા પાપડ", "sides", "jain", "Indian", 1, 2, 8],
  ["raita", "Boondi Raita", "બુંદી રાયતું", "sides", "jain", "North Indian", 0, 6, 18],
];

const about: Record<string, string> = {
  starters: "Served hot from the counter with mint and tamarind chutney.",
  chaat: "Assembled live in front of guests.",
  mains: "Slow-cooked in the main kitchen and held hot in chafing dishes.",
  breads: "Made fresh on the tawa or tandoor at the venue.",
  rice: "Long-grain basmati, cooked in small batches.",
  sweets: "Prepared in pure ghee by our mithai section.",
  desserts: "Served chilled from a dedicated counter.",
  beverages: "Served at the welcome counter as guests arrive.",
  sides: "Placed on every buffet line.",
};

export const items: MenuItem[] = rows.map(([id, name, nameLocal, categoryId, diet, cuisine, spice, cost, price, flags = ""]) => ({
  id,
  name,
  nameLocal,
  categoryId,
  diet,
  cuisine,
  spice,
  unit: categoryId === "beverages" ? "glass" : "plate",
  pricingType: flags.includes("c") ? "counter" : "plate",
  cost,
  price,
  photo: photos[id] ? `/dishes/${photos[id].file}` : undefined,
  description: about[categoryId],
  active: true,
  outsourced: flags.includes("o"),
  seasonal: flags.includes("s"),
  bestseller: flags.includes("b"),
  recipeBase: 100,
  bufferPct: 5,
  agencyRate: 0,
}));

const fixed = ["masala-chaas", "papad", "raita"];

export const packages: MenuPackage[] = [
  {
    id: "silver",
    name: "Silver",
    tier: "silver",
    pricePerPlate: 450,
    minPax: 100,
    fixedItemIds: fixed,
    description: "A complete Gujarati-Punjabi buffet for family functions.",
    rules: [
      { categoryId: "starters", choose: 2 },
      { categoryId: "mains", choose: 3 },
      { categoryId: "breads", choose: 2 },
      { categoryId: "rice", choose: 1 },
      { categoryId: "sweets", choose: 1 },
    ],
  },
  {
    id: "gold",
    name: "Gold",
    tier: "gold",
    pricePerPlate: 650,
    minPax: 150,
    fixedItemIds: fixed,
    description: "Our most booked wedding menu, with a chaat counter.",
    rules: [
      { categoryId: "starters", choose: 3 },
      { categoryId: "chaat", choose: 1 },
      { categoryId: "mains", choose: 4 },
      { categoryId: "breads", choose: 2 },
      { categoryId: "rice", choose: 2 },
      { categoryId: "sweets", choose: 2 },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tier: "premium",
    pricePerPlate: 900,
    minPax: 200,
    fixedItemIds: fixed,
    description: "The full spread: welcome drinks, live counters and a dessert bar.",
    rules: [
      { categoryId: "beverages", choose: 2 },
      { categoryId: "starters", choose: 4 },
      { categoryId: "chaat", choose: 2 },
      { categoryId: "mains", choose: 5 },
      { categoryId: "breads", choose: 3 },
      { categoryId: "rice", choose: 2 },
      { categoryId: "sweets", choose: 3 },
      { categoryId: "desserts", choose: 1 },
    ],
  },
];

const silverMenu = [...fixed, "samosa", "dhokla", "paneer-butter-masala", "chole", "dal-tadka", "puri", "phulka-roti", "jeera-rice", "gulab-jamun"];
const goldMenu = [
  ...fixed, "paneer-tikka", "hara-bhara-kabab", "khandvi", "pani-puri", "paneer-butter-masala", "dal-makhani", "undhiyu",
  "malai-kofta", "naan", "puri", "jeera-rice", "veg-biryani", "gulab-jamun", "rasmalai",
];
const premiumMenu = [
  ...fixed, "mango-lassi", "thandai", "paneer-tikka", "hara-bhara-kabab", "dhokla", "spring-roll", "pani-puri", "pav-bhaji",
  "paneer-butter-masala", "dal-makhani", "undhiyu", "malai-kofta", "palak-paneer", "naan", "puri", "paratha", "jeera-rice",
  "veg-biryani", "gulab-jamun", "rasmalai", "kaju-katli", "kulfi",
];
const lightMenu = ["masala-chaas", "dhokla", "khandvi", "dabeli", "bhel-puri", "sev-puri", "jalebi", "masala-chai"];

export const defaultTenant: Tenant = {
  name: "Royal Caterers",
  tagline: "Weddings, corporate and family functions since 1998",
  city: "Ahmedabad",
  phone: "98250 12345",
  email: "hello@royalcaterers.in",
  address: "14, Shreeji Arcade, Satellite Road, Ahmedabad 380015",
  brandColor: "#7c2d12",
  gstin: "24ABCDE1234F1Z5",
  bankName: "HDFC Bank, Satellite",
  bankAccount: "50200012345678",
  ifsc: "HDFC0000123",
  upiId: "royalcaterers@hdfcbank",
  quotePrefix: "QT",
  orderPrefix: "ORD",
  invoicePrefix: "INV",
  terms:
    "50% advance confirms the booking. Final guest count is locked 3 days before the event. Balance is payable on the event day. Extra plates are billed at the per-plate rate.",
  gstRate: 5,
  gstInclusive: false,
  discountApprovalPct: 10,
  dailyCapacityPax: 1500,
  slabs: [{ upTo: 300, pct: 0 }, { upTo: 500, pct: 3 }, { pct: 5 }],
};

export const users: TeamUser[] = [
  { id: "u-owner", name: "Mirage Thakore", phone: "98250 12345", role: "owner" },
  { id: "u-sales", name: "Priya Shah", phone: "98980 22110", role: "sales" },
  { id: "u-ops", name: "Kiran Solanki", phone: "99090 33221", role: "operations" },
  { id: "u-kitchen", name: "Ramesh Maharaj", phone: "97240 44332", role: "kitchen" },
  { id: "u-store", name: "Jignesh Parmar", phone: "96010 55443", role: "store" },
  { id: "u-accounts", name: "Nisha Vora", phone: "95580 66554", role: "accountant" },
];

export const clients: Client[] = [
  { id: "c-shah", name: "Rajesh Shah", phone: "98250 70011", email: "rajesh.shah@example.com", address: "Bodakdev, Ahmedabad", type: "retail", tags: ["vip"], language: "gu" },
  { id: "c-infocity", name: "Infocity Tech Pvt Ltd", phone: "97270 70022", email: "admin@infocitytech.example.com", address: "GIFT City, Gandhinagar", gstin: "24AAACI1234K1Z2", type: "corporate", tags: ["repeat"], language: "en" },
  { id: "c-desai", name: "Hetal Desai", phone: "99250 70033", address: "Vastrapur, Ahmedabad", type: "retail", tags: [], language: "gu" },
  { id: "c-patel", name: "Bhavesh Patel", phone: "98790 70044", address: "Naranpura, Ahmedabad", type: "retail", tags: ["repeat"], language: "gu" },
  { id: "c-mehta", name: "Anjali Mehta", phone: "90990 70055", address: "Prahlad Nagar, Ahmedabad", type: "retail", tags: [], language: "en" },
  { id: "c-trivedi", name: "Dr. Nilesh Trivedi", phone: "98240 70066", address: "Maninagar, Ahmedabad", type: "retail", tags: [], language: "gu" },
  { id: "c-agarwal", name: "Suresh Agarwal", phone: "93270 70077", address: "Shahibaug, Ahmedabad", type: "retail", tags: ["vip"], language: "hi" },
  { id: "c-events", name: "Utsav Event Planners", phone: "98980 70088", address: "CG Road, Ahmedabad", type: "agency", tags: ["repeat"], language: "en" },
  { id: "c-joshi", name: "Kavita Joshi", phone: "94270 70099", address: "Thaltej, Ahmedabad", type: "retail", tags: [], language: "gu" },
];

export interface SeedData {
  enquiries: Enquiry[];
  quotations: Quotation[];
  orders: Order[];
  revenueHistory: { month: string; amount: number }[];
  counters: { quote: number; order: number; receipt: number };
}

/** Dated demo records, built relative to `now` so the dashboard always has upcoming events. */
export function createSeed(now: Date): SeedData {
  const day = (offset: number) => isoDate(addDays(now, offset));
  const fy = financialYear(now);
  let fnSeq = 0;
  const fn = (name: string, offset: number, time: string, venue: string, pax: number, packageId: string | undefined, itemIds: string[]): EventFunction => ({
    id: `f${++fnSeq}`,
    name,
    date: day(offset),
    time,
    venue,
    pax,
    packageId,
    itemIds,
  });
  let rc = 0;
  const pay = (amount: number, mode: Payment["mode"], offset: number, note: string): Payment => ({
    id: `p${++rc}`,
    amount,
    mode,
    date: day(offset),
    note,
    receiptNo: `RCT/${fy}/${String(rc).padStart(4, "0")}`,
  });
  const base = { discount: { type: "amount" as const, value: 0 }, gstRate: 5, gstInclusive: false, changeLog: [], instructions: "", commissionPct: 0 };
  const extra = (label: string, amount: number) => ({ id: `x${label}${amount}`, label, amount });

  const shahFns = [
    fn("Haldi", 3, "10:00", "Shah Residence, Bodakdev", 150, undefined, lightMenu),
    fn("Sangeet", 4, "19:30", "The Grand Bhagwati, SG Highway", 350, "gold", goldMenu),
    fn("Wedding", 5, "11:30", "Karnavati Club Lawn", 600, "premium", premiumMenu),
    fn("Reception", 6, "19:00", "Karnavati Club Lawn", 800, "premium", [...premiumMenu, "masala-dosa", "paan"]),
  ];
  const corpFns = [fn("Annual Day Lunch", 1, "12:30", "Infocity Tech, GIFT City", 220, "silver", silverMenu)];
  const desaiFns = [fn("Engagement", 12, "18:30", "Rajpath Club Banquet", 250, "gold", goldMenu)];
  const patelFns = [fn("Housewarming Lunch", -9, "12:00", "Patel Residence, Naranpura", 180, "silver", silverMenu)];
  const utsavFns = [fn("Product Launch Dinner", 19, "20:00", "Hyatt Regency, Ashram Road", 300, "gold", [...goldMenu, "ice-cream"])];

  const orders: Order[] = [
    {
      ...base,
      id: "o-shah",
      number: `ORD/${fy}/0041`,
      quotationId: "q-shah",
      clientId: "c-shah",
      eventType: "Wedding",
      functions: shahFns,
      extras: [extra("Service staff and uniforms", 85000), extra("Transport", 24000), extra("Crockery and counters", 60000)],
      discount: { type: "amount", value: 50000 },
      status: "confirmed",
      payments: [pay(500000, "bank", -21, "Booking advance"), pay(400000, "upi", -5, "Second instalment")],
      changeLog: [{ id: "cl1", at: day(-4), by: "Priya Shah", text: "Reception guests raised from 700 to 800", priceImpact: 85500 }],
      instructions: "Jain counter needed at every function. No onion or garlic at the Haldi.",
      managerId: "u-ops",
      createdAt: day(-21),
    },
    {
      ...base,
      id: "o-infocity",
      number: `ORD/${fy}/0042`,
      quotationId: "q-infocity",
      clientId: "c-infocity",
      eventType: "Corporate",
      functions: corpFns,
      extras: [extra("Service staff", 9000)],
      status: "confirmed",
      payments: [pay(55000, "bank", -6, "Advance against PO")],
      instructions: "Entry through gate 3. Security needs vehicle numbers a day before.",
      managerId: "u-ops",
      createdAt: day(-8),
    },
    {
      ...base,
      id: "o-desai",
      number: `ORD/${fy}/0043`,
      quotationId: "q-desai",
      clientId: "c-desai",
      eventType: "Engagement",
      functions: desaiFns,
      extras: [extra("Service staff", 14000), extra("Transport", 6000)],
      status: "tentative",
      payments: [],
      managerId: "u-ops",
      createdAt: day(-2),
    },
    {
      ...base,
      id: "o-patel",
      number: `ORD/${fy}/0040`,
      clientId: "c-patel",
      eventType: "Housewarming",
      functions: patelFns,
      extras: [extra("Service staff", 7000)],
      status: "completed",
      payments: [pay(40000, "upi", -20, "Advance"), pay(52400, "cash", -9, "Final settlement")],
      managerId: "u-ops",
      createdAt: day(-24),
    },
  ];

  const quote = (id: string, seq: number, o: Pick<Order, "clientId" | "eventType" | "functions" | "extras" | "discount">, status: Quotation["status"], created: number, enquiryId?: string): Quotation => ({
    id,
    number: `QT/${fy}/${String(seq).padStart(4, "0")}`,
    groupId: id,
    version: 1,
    enquiryId,
    clientId: o.clientId,
    eventType: o.eventType,
    functions: o.functions,
    extras: o.extras,
    discount: o.discount,
    gstRate: 5,
    gstInclusive: false,
    status,
    validUntil: day(created + 15),
    notes: "",
    createdBy: "u-sales",
    createdAt: day(created),
  });

  const quotations: Quotation[] = [
    quote("q-shah", 61, orders[0], "approved", -23),
    quote("q-infocity", 62, orders[1], "approved", -9),
    quote("q-desai", 63, orders[2], "approved", -4, "e-desai"),
    quote("q-utsav", 64, { clientId: "c-events", eventType: "Corporate", functions: utsavFns, extras: [extra("Service staff", 16000)], discount: { type: "percent", value: 5 } }, "sent", -3, "e-utsav"),
    quote("q-agarwal", 65, { clientId: "c-agarwal", eventType: "Anniversary", functions: [fn("25th Anniversary Dinner", 26, "19:30", "Agarwal Farm, Shilaj", 400, "premium", premiumMenu)], extras: [extra("Service staff", 22000)], discount: { type: "amount", value: 0 } }, "draft", -1, "e-agarwal"),
  ];

  const enq = (id: string, clientId: string, eventType: string, offset: number, venue: string, pax: number, budget: number, stage: Enquiry["stage"], source: Enquiry["source"], follow: number | undefined, created: number, notes = "", rest: Partial<Enquiry> = {}): Enquiry => ({
    id,
    clientId,
    eventType,
    date: day(offset),
    venue,
    pax,
    budgetPerPlate: budget,
    foodPref: "veg",
    notes,
    source,
    stage,
    assignedTo: "u-sales",
    followUpAt: follow === undefined ? undefined : day(follow),
    createdAt: day(created),
    ...rest,
  });

  const enquiries: Enquiry[] = [
    enq("e-mehta", "c-mehta", "Wedding", 48, "YMCA Club, SG Highway", 700, 850, "new", "website", 0, 0, "Two functions: wedding lunch and reception. Wants a live dosa counter."),
    enq("e-joshi", "c-joshi", "Baby Shower", 22, "Joshi Residence, Thaltej", 120, 500, "new", "whatsapp", 1, -1, "Jain food only.", { foodPref: "jain" }),
    enq("e-trivedi", "c-trivedi", "Birthday", 15, "Trivedi Hospital Hall, Maninagar", 200, 550, "contacted", "phone", -1, -4, "Asked for menu options on WhatsApp."),
    enq("e-utsav", "c-events", "Corporate", 19, "Hyatt Regency, Ashram Road", 300, 700, "quoted", "referral", 2, -6, "Planner takes 8% commission."),
    enq("e-agarwal", "c-agarwal", "Anniversary", 26, "Agarwal Farm, Shilaj", 400, 950, "followup", "walkin", 0, -7, "Comparing with one more caterer. Likes the premium menu."),
    enq("e-desai", "c-desai", "Engagement", 12, "Rajpath Club Banquet", 250, 650, "booked", "phone", undefined, -10),
    enq("e-lost", "c-patel", "Birthday", 30, "Patel Residence, Naranpura", 80, 350, "lost", "whatsapp", undefined, -14, "", { lostReason: "Budget too low" }),
  ];

  const revenueHistory = [640000, 910000, 520000, 1380000, 1120000].map((amount, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: isoDate(d).slice(0, 7), amount };
  });

  return { enquiries, quotations, orders, revenueHistory, counters: { quote: 65, order: 43, receipt: rc } };
}
