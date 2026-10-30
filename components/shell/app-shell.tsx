"use client";

import { useStock } from "@/components/supply/common";
import { balanceOf, scheduleRows, useBilling } from "@/lib/billing";
import { useOps } from "@/lib/operations";
import { priceQuote } from "@/lib/pricing";
import { useStaff } from "@/lib/staff";
import { useSupply } from "@/lib/supply-store";
import {
  Bell,
  Building,
  LifeBuoy,
  Lock,
  Sparkles,
  Check,
  Languages,
  ListChecks,
  LogOut,
  Maximize,
  Minimize,
  Menu as MenuIcon,
  MessagesSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Presentation,
  Search,
  Sun,
  Wallet,
  CalendarDays,
  ClipboardList,
  Home,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/blocks";
import { HelpSheet, PlatformBanner, PlatformGate, WhatsNewSheet } from "@/components/shell/platform-ui";
import { usePlan } from "@/lib/platform";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Avatar } from "@/components/shared/blocks";
import { EnquirySheet } from "@/components/sales/enquiry-sheet";
import { PaymentSheet } from "@/components/sales/payment-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { isActive, navFor, navItemFor } from "@/lib/nav";
import { useCurrentUser, useStore } from "@/lib/store";
import type { Locale, Role } from "@/lib/types";
import { useTheme, useUi } from "@/lib/ui";
import { cn, daysFromToday, initials, isoDate, money, relativeDay } from "@/lib/utils";
import { CommandPalette } from "./command-palette";

const languages: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "gu", label: "ગુજરાતી" },
];

const roles: Role[] = ["owner", "sales", "operations", "kitchen", "store", "accountant"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const signedIn = useStore((s) => s.signedIn);
  const setupDone = useStore((s) => s.setupDone);
  const ready = hydrated && signedIn && setupDone;

  React.useEffect(() => {
    if (!hydrated) return;
    // A signed-out visitor to the site's front door sees the marketing page; deeper links ask them to log in.
    if (!signedIn) router.replace(window.location.pathname === "/" ? "/welcome" : "/login");
    else if (!setupDone) router.replace("/setup");
  }, [hydrated, signedIn, setupDone, router]);

  if (!ready) return <ShellSkeleton />;

  return (
    <div className="flex min-h-dvh" data-app-root>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <PlatformBanner />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-10 md:pt-6">
          <PlatformGate><React.Suspense fallback={null}><AccessGuard>{children}</AccessGuard></React.Suspense></PlatformGate>
        </main>
      </div>
      <MobileTabs />
      <CommandPalette />
      <EnquirySheet />
      <PaymentSheet />
    </div>
  );
}

/** Stops a role opening a page the owner has switched off for it, even from a typed or old link. */
function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const access = useStore((s) => s.tenant.access);
  const planModules = usePlan().plan?.modules;
  const item = navItemFor(pathname);
  const allowed = !item || navFor(user.role, access, planModules).some((n) => n.key === item.key);
  if (allowed) return <>{children}</>;
  return <EmptyState icon={Lock} title="You do not have access to this page" help="Your role cannot open it. Ask the owner if you need it." action={<Button variant="primary" asChild><Link href="/">Go to home</Link></Button>} />;
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="hidden w-16 shrink-0 border-r bg-surface-muted md:block lg:w-60" />
      <div className="flex-1 p-4 md:p-6">
        <Skeleton className="h-8 w-56" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64 rounded-xl" />
      </div>
    </div>
  );
}

function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const user = useCurrentUser();
  const access = useStore((s) => s.tenant.access);
  const planModules = usePlan().plan?.modules;
  const tenant = useStore((s) => s.tenant);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggle = useStore((s) => s.toggleSidebar);
  const label = collapsed ? "hidden" : "hidden lg:block";

  return (
    <aside className={cn("sticky top-0 hidden h-dvh w-16 shrink-0 flex-col border-r bg-surface-muted transition-[width] duration-200 ease-out md:flex print:!hidden", collapsed ? "lg:w-16" : "lg:w-60")}>
      <div className="flex h-14 shrink-0 items-center gap-3 px-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-fg">{initials(tenant.name)}</span>
        <div className={cn("min-w-0", label)}>
          <p className="truncate font-heading text-sm font-semibold">{tenant.name}</p>
          <p className="truncate text-xs text-text-muted">{tenant.city}</p>
        </div>
      </div>
      <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2" aria-label="Main">
        {navFor(user.role, access, planModules).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              title={t(item.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors duration-150",
                active ? "bg-surface text-primary shadow-card" : "text-text-muted hover:bg-surface/60 hover:text-text",
              )}
            >
              <item.icon className="size-5 shrink-0" strokeWidth={1.75} />
              <span className={cn("flex-1 truncate", label)}>{t(item.key)}</span>
              {item.phase && <span className={cn("tnum rounded-full bg-border/70 px-1.5 text-xs text-text-muted", label)}>P{item.phase}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="hidden shrink-0 border-t p-2.5 lg:block">
        <button type="button" onClick={toggle} className="flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-text-muted hover:bg-surface/60 hover:text-text" aria-label={collapsed ? t("expand") : t("collapse")}>
          {collapsed ? <PanelLeftOpen className="size-5 shrink-0" strokeWidth={1.75} /> : <PanelLeftClose className="size-5 shrink-0" strokeWidth={1.75} />}
          <span className={label}>{t("collapse")}</span>
        </button>
      </div>
    </aside>
  );
}

function useQuickActions() {
  const t = useTranslations("common");
  const router = useRouter();
  const role = useCurrentUser().role;
  const openEnquiry = useUi((s) => s.openEnquiry);
  const openPayment = useUi((s) => s.openPayment);
  const sales = role === "owner" || role === "sales";
  return [
    sales && { label: t("newEnquiry"), icon: MessagesSquare, run: () => openEnquiry() },
    sales && { label: t("bookingMode"), icon: Presentation, run: () => router.push("/booking") },
    (sales || role === "accountant") && { label: t("recordPayment"), icon: Wallet, run: () => openPayment() },
  ].filter((a): a is { label: string; icon: typeof Wallet; run: () => void } => !!a);
}

function useAlerts() {
  const enquiries = useStore((s) => s.enquiries);
  const orders = useStore((s) => s.orders);
  const clients = useStore((s) => s.clients);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const slabs = useStore((s) => s.tenant.slabs);
  const credits = useBilling((s) => s.credits);
  // Read so that edited schedules refresh the alerts; scheduleFor reads them.
  useBilling((s) => s.milestones);
  const scheduleFor = useBilling((s) => s.scheduleFor);
  const tasks = useStaff((s) => s.tasks);
  const ingredients = useSupply((s) => s.ingredients);
  const stock = useStock();
  const issues = useOps((s) => s.issues);
  return React.useMemo(() => {
    const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
    const followUps = enquiries
      .filter((e) => e.followUpAt && !["booked", "lost"].includes(e.stage) && daysFromToday(e.followUpAt) <= 0)
      .map((e) => ({ id: e.id, href: "/enquiries", title: `Follow up with ${name(e.clientId)}`, sub: `${e.eventType} · due ${relativeDay(e.followUpAt!).toLowerCase()}`, tone: daysFromToday(e.followUpAt!) < 0 ? "danger" : "warning" }));
    const tentative = orders
      .filter((o) => o.status === "tentative")
      .map((o) => ({ id: o.id, href: `/orders/${o.id}`, title: `${name(o.clientId)} has not paid the advance`, sub: `${o.number} is still tentative`, tone: "warning" }));
    const today = isoDate(new Date());
    const fresh = enquiries
      .filter((e) => e.createdAt?.slice(0, 10) === today && e.stage === "new")
      .map((e) => ({ id: `new-${e.id}`, href: "/enquiries", title: `New enquiry from ${name(e.clientId)}`, sub: `${e.eventType} · ${e.pax} guests`, tone: "info" }));
    const received = orders.flatMap((o) => o.payments.filter((p) => p.date === today).map((p) => ({ id: `paid-${p.id}`, href: `/orders/${o.id}?tab=payments`, title: `${money(p.amount)} received from ${name(o.clientId)}`, sub: p.receiptNo, tone: "success" })));
    const live = orders.filter((o) => o.status !== "cancelled");
    const late = live.flatMap((o) => {
      const grand = priceQuote(o, items, packages, slabs).grand;
      const { bill, received: got } = balanceOf(o, grand, credits);
      return scheduleRows(scheduleFor(o), bill, got).filter((r) => r.state === "overdue").map((r) => ({ id: `due-${r.id}`, href: `/orders/${o.id}?tab=payments`, title: `${money(r.amount - r.covered)} overdue from ${name(o.clientId)}`, sub: `${r.label} · ${r.daysLate} ${r.daysLate === 1 ? "day" : "days"} late`, tone: "danger" }));
    });
    const fnDate = new Map(live.flatMap((o) => o.functions.map((f) => [f.id, f.date] as const)));
    const overdueTasks = tasks.filter((t) => t.status !== "done" && t.status !== "verified" && (fnDate.get(t.functionId) ?? "9999") < today);
    const taskAlert = overdueTasks.length ? [{ id: "tasks", href: "/staff", title: `${overdueTasks.length} ${overdueTasks.length === 1 ? "task is" : "tasks are"} overdue`, sub: "Their event date has passed but they are not marked done", tone: "warning" }] : [];
    const low = ingredients.filter((i) => i.reorderLevel > 0 && (stock.get(i.id) ?? 0) < i.reorderLevel);
    const stockAlert = low.length ? [{ id: "stock", href: "/purchase", title: `${low.length} ${low.length === 1 ? "item is" : "items are"} low on stock`, sub: low.slice(0, 3).map((i) => i.name).join(", "), tone: "warning" }] : [];
    const issueAlerts = issues.filter((i) => !i.resolved).map((i) => ({ id: `issue-${i.id}`, href: `/onsite?fn=${i.functionId}`, title: "Open issue at an event", sub: i.note, tone: "danger" }));
    const md = today.slice(5);
    const days = clients.flatMap((c) => [c.birthday?.slice(5) === md ? { id: `bd-${c.id}`, href: "/messages", title: `${c.name}'s birthday today`, sub: "Send a greeting", tone: "info" } : null, c.anniversary?.slice(5) === md ? { id: `an-${c.id}`, href: "/messages", title: `${c.name}'s anniversary today`, sub: "Send a greeting", tone: "info" } : null]).filter((x) => x !== null);
    return [...issueAlerts, ...late, ...fresh, ...received, ...followUps, ...tentative, ...taskAlert, ...stockAlert, ...days];
  }, [enquiries, orders, clients, items, packages, slabs, credits, scheduleFor, tasks, ingredients, stock, issues]);
}

/** Which branch the app is showing. Someone tied to a branch just sees its name. */
function BranchSwitcher() {
  const { branches, branchesEnabled, myBranch, branchPref, setBranch } = useStore();
  const [busy, setBusy] = React.useState(false);
  if (!branchesEnabled || branches.length === 0) return null;
  const current = branches.find((b) => b.id === (myBranch || branchPref));
  if (myBranch) return <span className="hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-text-muted md:inline-flex"><Building className="size-4" strokeWidth={1.75} />{current?.name}</span>;
  const pick = async (id: string) => {
    setBusy(true);
    await setBranch(id);
    setBusy(false);
    toast.success(id ? `Showing ${branches.find((b) => b.id === id)?.name}` : "Showing all branches");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" loading={busy} className="max-w-48"><Building strokeWidth={1.75} /><span className="truncate max-sm:hidden">{current?.name ?? "All branches"}</span></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Branch</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void pick("")}>{!current && <Check strokeWidth={2} />}All branches</DropdownMenuItem>
        {branches.map((b) => <DropdownMenuItem key={b.id} onSelect={() => void pick(b.id)}>{current?.id === b.id && <Check strokeWidth={2} />}{b.name}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const onFullscreenChange = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};

/** Fills the whole screen with the app, hiding the browser's tabs and address bar; Esc or the button again leaves. */
function FullscreenButton() {
  const on = React.useSyncExternalStore(onFullscreenChange, () => !!document.fullscreenElement, () => false);
  // iPhones and some in-app browsers cannot do this, so the button only shows where it works.
  const supported = React.useSyncExternalStore(onFullscreenChange, () => !!document.fullscreenEnabled, () => false);
  if (!supported) return null;
  const toggle = () => {
    const done = on ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    void done.catch(() => toast.error("Full screen is not available here"));
  };
  const label = on ? "Exit full screen" : "Full screen";
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={`${label}${on ? " (Esc)" : ""}`} aria-pressed={on}>
      {on ? <Minimize strokeWidth={1.75} /> : <Maximize strokeWidth={1.75} />}
    </Button>
  );
}

function Topbar() {
  const t = useTranslations("common");
  const tr = useTranslations("roles");
  const router = useRouter();
  const user = useCurrentUser();
  const myRole = useStore((s) => s.myRole);
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const setViewAs = useStore((s) => s.setViewAs);
  const signOut = useStore((s) => s.signOut);
  const [help, setHelp] = React.useState(false);
  const [news, setNews] = React.useState(false);
  const setSearch = useUi((s) => s.setSearch);
  const { theme, toggle } = useTheme();
  const actions = useQuickActions();
  const alerts = useAlerts();

  return (
    <>
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-bg/95 px-4 md:px-6 print:hidden">
      <button
        type="button"
        onClick={() => setSearch(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-surface px-3 text-left text-sm text-text-muted transition-colors duration-150 hover:border-text-muted/40 md:max-w-md"
      >
        <Search className="size-5 shrink-0" strokeWidth={1.75} />
        <span className="flex-1 truncate">{t("search")}</span>
        <kbd className="hidden rounded border bg-surface-muted px-1.5 text-xs md:block">Ctrl K</kbd>
      </button>
      <div className="flex-1 max-md:hidden" />

      {actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="max-md:hidden">
              <Plus strokeWidth={2} />
              {t("quickAdd")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {actions.map((a) => (
              <DropdownMenuItem key={a.label} onSelect={a.run}>
                <a.icon strokeWidth={1.75} />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <BranchSwitcher />

      <FullscreenButton />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications")}>
            <Bell strokeWidth={1.75} />
            {alerts.length > 0 && <span className="tnum absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-danger text-xs font-semibold text-surface">{alerts.length}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[70vh] w-80 overflow-y-auto">
          <DropdownMenuLabel>{t("notifications")}</DropdownMenuLabel>
          {alerts.length === 0 && <p className="px-2 py-4 text-center text-sm text-text-muted">You are all caught up.</p>}
          {alerts.slice(0, 12).map((a) => (
            <DropdownMenuItem key={a.id} className="h-auto items-start py-2" onSelect={() => router.push(a.href)}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.tone === "danger" ? "bg-danger" : a.tone === "success" ? "bg-success" : a.tone === "info" ? "bg-info" : "bg-warning")} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.title}</span>
                <span className="block truncate text-xs text-text-muted">{a.sub}</span>
              </span>
            </DropdownMenuItem>
          ))}
          {alerts.length > 12 && <p className="px-2 py-2 text-center text-xs text-text-muted">and {alerts.length - 12} more</p>}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("language")}>
            <Languages strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {languages.map((l) => (
            <DropdownMenuItem key={l.id} onSelect={() => setLocale(l.id)}>
              <span className="flex-1">{l.label}</span>
              {locale === l.id && <Check className="!text-primary" strokeWidth={2} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full" aria-label={user.name}>
          <Avatar name={user.name} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <div className="px-2 py-2">
            <p className="truncate font-medium">{user.name}</p>
            <p className="text-xs text-text-muted">{tr(user.role)}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={toggle}>
            {theme === "dark" ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
            {theme === "dark" ? t("light") : t("dark")} {t("theme").toLowerCase()}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {myRole === "owner" && (
            <>
              <DropdownMenuLabel>{t("viewingAs")}</DropdownMenuLabel>
              {roles.map((r) => (
                <DropdownMenuItem key={r} onSelect={() => { setViewAs(r === "owner" ? undefined : r); router.push("/"); }}>
                  <span className="flex-1">{tr(r)}</span>
                  {user.role === r && <Check className="!text-primary" strokeWidth={2} />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => setHelp(true)}>
            <LifeBuoy strokeWidth={1.75} />
            Help and support
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setNews(true)}>
            <Sparkles strokeWidth={1.75} />
            What&apos;s new
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut().then(() => router.replace("/login"))}>
            <LogOut strokeWidth={1.75} />
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
    <HelpSheet open={help} onOpenChange={setHelp} />
    <WhatsNewSheet open={news} onOpenChange={setNews} />
    </>
  );
}

function MobileTabs() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const user = useCurrentUser();
  const access = useStore((s) => s.tenant.access);
  const planModules = usePlan().plan?.modules;
  const actions = useQuickActions();
  const [more, setMore] = React.useState(false);
  const [add, setAdd] = React.useState(false);
  const tabs = [
    { key: "home", href: "/", icon: Home },
    { key: "calendar", href: "/calendar", icon: CalendarDays },
    null,
    { key: "orders", href: "/orders", icon: ClipboardList },
    { key: "tasks", href: "/staff", icon: ListChecks },
  ];
  const tab = "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium";

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden" aria-label="Main">
        {tabs.map((item) =>
          item ? (
            <Link key={item.key} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} className={cn(tab, isActive(pathname, item.href) ? "text-primary" : "text-text-muted")}>
              <item.icon className="size-5" strokeWidth={1.75} />
              {t(item.key)}
            </Link>
          ) : (
            <div key="add" className="relative w-16 shrink-0">
              <button type="button" onClick={() => setAdd(true)} aria-label={tc("quickAdd")} className="absolute -top-5 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-fg shadow-sheet">
                <Plus className="size-6" strokeWidth={2} />
              </button>
            </div>
          ),
        )}
        <button type="button" onClick={() => setMore(true)} className={cn(tab, "text-text-muted")}>
          <MenuIcon className="size-5" strokeWidth={1.75} />
          {t("more")}
        </button>
      </nav>

      <Sheet open={add} onOpenChange={setAdd} title={tc("quickAdd")}>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <button key={a.label} type="button" onClick={() => { setAdd(false); a.run(); }} className="flex h-24 flex-col items-start justify-between rounded-xl border bg-surface p-3 text-left text-sm font-medium hover:border-primary">
              <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
                <a.icon className="size-5" strokeWidth={1.75} />
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={more} onOpenChange={setMore} title={t("more")}>
        <div className="grid grid-cols-3 gap-2">
          {navFor(user.role, access, planModules).map((item) => (
            <Link key={item.key} href={item.href} onClick={() => setMore(false)} className={cn("flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 text-center text-xs font-medium", isActive(pathname, item.href) ? "border-primary bg-primary-soft text-primary" : "bg-surface text-text-muted")}>
              <item.icon className="size-5" strokeWidth={1.75} />
              <span className="line-clamp-2 leading-tight">{t(item.key)}</span>
            </Link>
          ))}
        </div>
      </Sheet>
    </>
  );
}
