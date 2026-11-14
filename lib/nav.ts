import {
  BookOpen,
  Globe,
  Calculator,
  Contact,
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  Truck,
  ClipboardList,
  QrCode,
  ScanLine,
  FileSpreadsheet,
  HandCoins,
  Home,
  MessageCircle,
  Settings,
  Sparkles,
  ShoppingBasket,
  Store,
  Users,
  UtensilsCrossed,
  Wallet,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { TenantAccess } from "./access";
import type { Role } from "./types";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
  roles: Role[] | "all";
  /** Set for modules that are planned but not built yet */
  phase?: number;
}

export const navItems: NavItem[] = [
  { key: "home", href: "/", icon: Home, roles: "all" },
  { key: "calendar", href: "/calendar", icon: CalendarDays, roles: ["owner", "sales", "operations", "kitchen"] },
  { key: "clients", href: "/clients", icon: Contact, roles: ["owner", "sales", "accountant"] },
  { key: "orders", href: "/orders", icon: ClipboardList, roles: ["owner", "sales", "operations", "accountant"] },
  { key: "calculator", href: "/calculator", icon: Calculator, roles: ["owner", "sales", "accountant"] },
  { key: "menu", href: "/menu", icon: UtensilsCrossed, roles: ["owner", "sales", "kitchen"] },
  { key: "publicmenu", href: "/public-menu", icon: Globe, roles: ["owner"] },
  { key: "kitchen", href: "/kitchen", icon: ChefHat, roles: ["owner", "operations", "kitchen"] },
  { key: "dispatch", href: "/dispatch", icon: Truck, roles: ["owner", "operations", "store"] },
  { key: "onsite", href: "/onsite", icon: ClipboardCheck, roles: ["owner", "operations"] },
  { key: "purchase", href: "/purchase", icon: ShoppingBasket, roles: ["owner", "store", "kitchen"] },
  { key: "recipes", href: "/recipes", icon: BookOpen, roles: ["owner", "store", "kitchen"] },
  { key: "labels", href: "/labels", icon: QrCode, roles: ["owner", "operations", "store"] },
  { key: "scan", href: "/scan", icon: ScanLine, roles: ["owner", "operations", "store", "kitchen"] },
  { key: "vendors", href: "/vendors", icon: Store, roles: ["owner", "store", "accountant"] },
  { key: "cutlery", href: "/cutlery", icon: Wine, roles: ["owner", "operations", "store"] },
  { key: "staff", href: "/staff", icon: Users, roles: ["owner", "operations", "accountant"] },
  { key: "payments", href: "/payments", icon: Wallet, roles: ["owner", "sales", "accountant"] },
  { key: "expenses", href: "/expenses", icon: HandCoins, roles: ["owner", "operations", "accountant"] },
  { key: "messages", href: "/messages", icon: MessageCircle, roles: ["owner", "sales"] },
  { key: "reports", href: "/reports", icon: BarChart3, roles: ["owner", "accountant"] },
  { key: "import", href: "/import", icon: FileSpreadsheet, roles: ["owner"] },
  { key: "assist", href: "/assist", icon: Sparkles, roles: ["owner", "sales", "kitchen"] },
  { key: "settings", href: "/settings", icon: Settings, roles: ["owner"] },
];

/** Items a role cannot use are hidden, not greyed. The owner's role settings can narrow this further. */
/** Pages added later go with the module they belong to, so plans and role settings made before them still work. */
const follows: Record<string, string> = { recipes: "purchase", calculator: "orders", publicmenu: "menu" };

export function navFor(role: Role, access?: TenantAccess, planModules?: string[]) {
  const narrowed = role === "owner" ? undefined : access?.roles[role];
  const has = (list: string[], key: string) => list.includes(key) || (!!follows[key] && list.includes(follows[key]));
  // The subscription plan can switch modules off for everyone; an empty list means all are included.
  const inPlan = (key: string) => !planModules?.length || key === "home" || key === "settings" || has(planModules, key);
  return navItems.filter((n) => (n.roles === "all" || n.roles.includes(role)) && inPlan(n.key) && (!narrowed || n.key === "home" || has(narrowed.modules, n.key)));
}

/** The nav item a path belongs to, if any. */
export const navItemFor = (pathname: string) =>
  // Quotations live inside Orders now, so a quotation's page follows the Orders access.
  isActive(pathname, "/quotations") ? navItems.find((n) => n.key === "orders") : [...navItems].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(pathname, n.href));

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
