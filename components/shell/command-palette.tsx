"use client";

import { Command } from "cmdk";
import { ClipboardList, FileText, MessagesSquare, Presentation, Search, User, UtensilsCrossed, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import * as React from "react";
import { navFor } from "@/lib/nav";
import { useCurrentUser, useStore } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useTranslations } from "next-intl";
import { usePlan } from "@/lib/platform";

const group = "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-muted";
const row = "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm data-[selected=true]:bg-surface-muted [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-text-muted";

/** Global search (Ctrl / Cmd + K): find records and run actions. */
export function CommandPalette() {
  const t = useTranslations();
  const router = useRouter();
  const open = useUi((s) => s.search);
  const setOpen = useUi((s) => s.setSearch);
  const openEnquiry = useUi((s) => s.openEnquiry);
  const openPayment = useUi((s) => s.openPayment);
  const user = useCurrentUser();
  const access = useStore((s) => s.tenant.access);
  const planModules = usePlan().plan?.modules;
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const quotations = useStore((s) => s.quotations);
  const items = useStore((s) => s.items);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUi.getState().search);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const go = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
  const sales = user.role === "owner" || user.role === "sales";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade bg-text/40 dark:bg-bg/70" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-[12dvh] z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 animate-fade overflow-hidden rounded-2xl border bg-surface shadow-sheet focus:outline-none">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Command loop>
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="size-5 shrink-0 text-text-muted" strokeWidth={1.75} />
              <Command.Input autoFocus placeholder={t("common.search")} className="h-12 flex-1 bg-transparent text-base placeholder:text-text-muted focus:outline-none" />
              <kbd className="rounded border bg-surface-muted px-1.5 text-xs text-text-muted">Esc</kbd>
            </div>
            <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-text-muted">Nothing matches that. Try a client name, order number or dish.</Command.Empty>
              {sales && (
                <Command.Group heading="Actions" className={group}>
                  <Command.Item className={row} onSelect={go(() => openEnquiry())}><MessagesSquare strokeWidth={1.75} />{t("common.newEnquiry")}</Command.Item>
                  <Command.Item className={row} onSelect={go(() => openPayment())}><Wallet strokeWidth={1.75} />{t("common.recordPayment")}</Command.Item>
                  <Command.Item className={row} onSelect={go(() => router.push("/booking"))}><Presentation strokeWidth={1.75} />{t("common.bookingMode")}</Command.Item>
                </Command.Group>
              )}
              <Command.Group heading="Go to" className={group}>
                {navFor(user.role, access, planModules).map((n) => (
                  <Command.Item key={n.key} className={row} onSelect={go(() => router.push(n.href))}><n.icon strokeWidth={1.75} />{t(`nav.${n.key}`)}</Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Orders" className={group}>
                {orders.map((o) => (
                  <Command.Item key={o.id} value={`${o.number} ${clientName(o.clientId)} ${o.eventType}`} className={row} onSelect={go(() => router.push(`/orders/${o.id}`))}>
                    <ClipboardList strokeWidth={1.75} />
                    <span className="flex-1 truncate">{clientName(o.clientId)} · {o.eventType}</span>
                    <span className="tnum text-xs text-text-muted">{o.number}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              {sales && (
                <Command.Group heading="Quotations" className={group}>
                  {quotations.filter((q) => q.status !== "superseded").map((q) => (
                    <Command.Item key={q.id} value={`${q.number} ${clientName(q.clientId)} quotation`} className={row} onSelect={go(() => router.push(`/quotations/${q.id}`))}>
                      <FileText strokeWidth={1.75} />
                      <span className="flex-1 truncate">{clientName(q.clientId)} · {q.eventType}</span>
                      <span className="tnum text-xs text-text-muted">{q.number}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Clients" className={group}>
                {clients.map((c) => (
                  <Command.Item key={c.id} value={`${c.name} ${c.phone}`} className={row} onSelect={go(() => router.push(`/clients?id=${c.id}`))}>
                    <User strokeWidth={1.75} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="tnum text-xs text-text-muted">{c.phone}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Dishes" className={group}>
                {items.map((i) => (
                  <Command.Item key={i.id} value={`${i.name} ${i.nameLocal}`} className={row} onSelect={go(() => router.push(`/menu?q=${encodeURIComponent(i.name)}`))}>
                    <UtensilsCrossed strokeWidth={1.75} />
                    <span className="flex-1 truncate">{i.name}</span>
                    <span className="text-xs text-text-muted">{i.nameLocal}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
