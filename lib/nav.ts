import {
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardList,
  FileText,
  Home,
  MessagesSquare,
  Settings,
  ShoppingBasket,
  Store,
  Users,
  UtensilsCrossed,
  Wallet,
  Wine,
  type LucideIcon,
} from "lucide-react";
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
  { key: "quotations", href: "/quotations", icon: FileText, roles: ["owner", "sales"] },
  { key: "orders", href: "/orders", icon: ClipboardList, roles: ["owner", "sales", "operations", "accountant"] },
  { key: "menu", href: "/menu", icon: UtensilsCrossed, roles: ["owner", "sales", "kitchen"] },
  { key: "kitchen", href: "/kitchen", icon: ChefHat, roles: ["owner", "operations", "kitchen"], phase: 4 },
  { key: "purchase", href: "/purchase", icon: ShoppingBasket, roles: ["owner", "store", "kitchen"] },
  { key: "vendors", href: "/vendors", icon: Store, roles: ["owner", "store", "accountant"] },
  { key: "cutlery", href: "/cutlery", icon: Wine, roles: ["owner", "operations", "store"] },
  { key: "staff", href: "/staff", icon: Users, roles: ["owner", "operations"], phase: 4 },
  { key: "payments", href: "/payments", icon: Wallet, roles: ["owner", "sales", "accountant"], phase: 5 },
  { key: "reports", href: "/reports", icon: BarChart3, roles: ["owner", "accountant"], phase: 6 },
  { key: "settings", href: "/settings", icon: Settings, roles: ["owner"] },
];

/** Items a role cannot use are hidden, not greyed. */
export function navFor(role: Role) {
  return navItems.filter((n) => n.roles === "all" || n.roles.includes(role));
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
