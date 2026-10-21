import {
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
  FileText,
  HandCoins,
  Home,
  MessageCircle,
  MessagesSquare,
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
  { key: "enquiries", href: "/enquiries", icon: MessagesSquare, roles: ["owner", "sales"] },
  { key: "clients", href: "/clients", icon: Contact, roles: ["owner", "sales", "accountant"] },
  { key: "quotations", href: "/quotations", icon: FileText, roles: ["owner", "sales"] },
  { key: "orders", href: "/orders", icon: ClipboardList, roles: ["owner", "sales", "operations", "accountant"] },
  { key: "menu", href: "/menu", icon: UtensilsCrossed, roles: ["owner", "sales", "kitchen"] },
  { key: "kitchen", href: "/kitchen", icon: ChefHat, roles: ["owner", "operations", "kitchen"] },
  { key: "dispatch", href: "/dispatch", icon: Truck, roles: ["owner", "operations", "store"] },
  { key: "onsite", href: "/onsite", icon: ClipboardCheck, roles: ["owner", "operations"] },
  { key: "purchase", href: "/purchase", icon: ShoppingBasket, roles: ["owner", "store", "kitchen"] },
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
export function navFor(role: Role, access?: TenantAccess, planModules?: string[]) {
  const narrowed = role === "owner" ? undefined : access?.roles[role];
  // The subscription plan can switch modules off for everyone; an empty list means all are included.
  const inPlan = (key: string) => !planModules?.length || key === "home" || key === "settings" || planModules.includes(key);
  return navItems.filter((n) => (n.roles === "all" || n.roles.includes(role)) && inPlan(n.key) && (!narrowed || n.key === "home" || narrowed.modules.includes(n.key)));
}

/** The nav item a path belongs to, if any. */
export const navItemFor = (pathname: string) => [...navItems].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(pathname, n.href));

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
