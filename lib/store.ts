"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { categoryRow, clientRow, enquiryRow, insertOrder, insertQuotation, itemRow, loadAll, paymentRow, run, savePackageRows, tenantRow } from "./db";
import { background, setReload, write } from "./queue";
import { supabase } from "./supabase/client";
import { useKitchen } from "./kitchen";
import { useOps } from "./operations";
import { useBilling } from "./billing";
import { useExpenses } from "./expenses";
import { useMessages } from "./messages";
import { eventsThisMonth, usePlatform } from "./platform";
import { useLabels } from "./labels";
import { withBranch } from "./branch";
import { setCategoryTree, treeOrder } from "./categories";
import { useStaff } from "./staff";
import { useSupply } from "./supply-store";
import type {
  Client,
  Enquiry,
  EnquiryStage,
  Locale,
  MenuCategory,
  MenuItem,
  MenuPackage,
  Order,
  OrderStatus,
  Payment,
  PaymentMode,
  Quotation,
  QuoteDraft,
  QuoteStatus,
  Role,
  TeamUser,
  Tenant,
} from "./types";
import { addDays, financialYear, isoDate, money, uid } from "./utils";

// The store is the in-memory copy of the signed-in caterer's data. It is loaded from Supabase
// after sign-in; every action updates it at once and writes the change to the database behind it.

interface Data {
  /** Branch picked in the top bar, kept between visits; "" for all branches */
  branchPref: string;
  branches: { id: string; name: string; address: string }[];
  branchesEnabled: boolean;
  myBranch: string;
  /** False until 0012 has added food types, sessions and end times */
  servicesReady: boolean;
  /** False until 0013 has added package additions and archiving */
  packageExtrasReady: boolean;
  /** False until 0014 has added referrals, raw material changes and dish prices */
  referralsReady: boolean;
  /** False until 0015 has added sub-categories */
  subcategoriesReady: boolean;
  tenantId: string;
  tenant: Tenant;
  users: TeamUser[];
  clients: Client[];
  categories: MenuCategory[];
  items: MenuItem[];
  packages: MenuPackage[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  orders: Order[];
  /** The signed-in user's profile id */
  currentUserId: string;
  myRole: Role;
  /** Owner-only preview of another role's screens. The database still enforces the real role. */
  viewAs?: Role;
  hydrated: boolean;
  signedIn: boolean;
  setupDone: boolean;
  locale: Locale;
  sidebarCollapsed: boolean;
  drafts: Record<string, QuoteDraft>;
}

interface Actions {
  init: () => Promise<void>;
  reload: () => Promise<boolean>;
  signOut: () => Promise<void>;
  completeSetup: () => void;
  updateTenant: (patch: Partial<Tenant>) => void;
  uploadMedia: (file: Blob, name: string) => Promise<string>;
  setLocale: (locale: Locale) => void;
  /** Shows one branch (or all, with "") and reloads the data for it. */
  setBranch: (branchId: string) => Promise<void>;
  setViewAs: (role?: Role) => void;
  toggleSidebar: () => void;
  addUser: (user: Omit<TeamUser, "id">) => void;
  removeUser: (id: string) => void;
  ensureClient: (name: string, phone: string, id?: string) => string;
  saveClient: (client: Client) => void;
  saveEnquiry: (enquiry: Omit<Enquiry, "id" | "createdAt"> & { id?: string }) => string;
  moveEnquiry: (id: string, stage: EnquiryStage, lostReason?: string) => void;
  saveItem: (item: Omit<MenuItem, "id"> & { id?: string }) => void;
  patchItems: (ids: string[], patch: Partial<MenuItem>) => void;
  raisePrices: (ids: string[], pct: number) => void;
  /** Puts the menu back to an earlier snapshot (Undo for bulk edits). */
  restoreItems: (snapshot: MenuItem[]) => void;
  savePackage: (pkg: Omit<MenuPackage, "id"> & { id?: string }) => void;
  /** Adds a menu category (at the end of its parent's branch), or renames one / changes its icon. Returns its id. */
  saveCategory: (category: Omit<MenuCategory, "id"> & { id?: string }) => string;
  /** Puts the categories in this order everywhere the menu is shown. */
  reorderCategories: (ids: string[]) => void;
  /** Deletes a category, first moving its dishes to another one. Package choices for it go with it. */
  deleteCategory: (id: string, moveDishesTo?: string) => Promise<void>;
  /** Deletes a package, or archives it when quotations or orders use it. Says which it did. */
  removePackage: (id: string) => "deleted" | "archived";
  saveDraft: (key: string, draft: QuoteDraft | null) => void;
  createQuotation: (draft: QuoteDraft, status: QuoteStatus) => Promise<string>;
  setQuoteStatus: (id: string, status: QuoteStatus) => void;
  convertToOrder: (quoteId: string) => Promise<string>;
  addPayment: (orderId: string, amount: number, mode: PaymentMode, note: string) => Promise<Payment>;
  setOrderStatus: (id: string, status: OrderStatus, cancelNote?: string) => void;
  patchOrder: (id: string, patch: Partial<Pick<Order, "instructions" | "commissionPct">>) => void;
  addOrderExtra: (orderId: string, label: string, amount: number) => void;
  changePax: (orderId: string, functionId: string, pax: number, priceImpact: number) => void;
  /** Raw material for one order changed by hand; an empty map goes back to the recipes. */
  setRawOverrides: (orderId: string, overrides: Record<string, number>) => void;
  /** A dish's per-plate price on a booked order; undefined goes back to the menu price. Logged as a change. */
  setOrderItemPrice: (orderId: string, functionId: string, itemId: string, price: number | undefined, priceImpact: number) => void;
  /** The client's referral code, made and saved the first time it is needed. */
  ensureReferralCode: (clientId: string) => string;
}

export type Store = Data & Actions;

const blankTenant: Tenant = {
  name: "", tagline: "", city: "", phone: "", email: "", address: "", brandColor: "#7c2d12", gstin: "", bankName: "", bankAccount: "", ifsc: "", upiId: "",
  quotePrefix: "QT", orderPrefix: "ORD", invoicePrefix: "INV", terms: "", gstRate: 5, gstInclusive: false, discountApprovalPct: 10, dailyCapacityPax: 1500, slabs: [{ pct: 0 }],
};

const signedOut = {
  tenantId: "", tenant: blankTenant, users: [], clients: [], categories: [], items: [], packages: [], enquiries: [], quotations: [], orders: [], branches: [], branchesEnabled: false, myBranch: "", servicesReady: false, packageExtrasReady: false, referralsReady: false, subcategoriesReady: false,
  currentUserId: "", myRole: "owner" as Role, viewAs: undefined, signedIn: false, setupDone: false,
};

const today = () => isoDate(new Date());
const docNo = (prefix: string, n: number) => `${prefix}/${financialYear()}/${String(n).padStart(4, "0")}`;

async function nextNumber(sb: SupabaseClient, docType: "quote" | "order" | "receipt") {
  const res = await sb.rpc("next_doc_number", { p_doc_type: docType, p_financial_year: financialYear() });
  if (res.error) throw new Error(res.error.message);
  return res.data as number;
}

let tenantTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...signedOut,
      hydrated: false,
      locale: "en",
      sidebarCollapsed: false,
      drafts: {},
      branchPref: "",

      init: async () => {
        const sb = supabase();
        if (!listening) {
          listening = true;
          sb.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT") set({ ...signedOut, hydrated: true });
          });
        }
        const { data } = await sb.auth.getSession();
        if (!data.session) {
          set({ ...signedOut, hydrated: true });
          return;
        }
        await get().reload();
      },

      reload: async () => {
        const sb = supabase();
        try {
          const { data } = await sb.auth.getSession();
          const loaded = data.session ? await loadAll(sb, data.session.user.id, get().branchPref) : null;
          if (!loaded) {
            set({ ...signedOut, hydrated: true });
            return false;
          }
          const { me, ...rest } = loaded;
          set({ ...rest, currentUserId: me.id, myRole: me.role, signedIn: true, hydrated: true });
          await Promise.all([useSupply.getState().load(), useStaff.getState().load(), useKitchen.getState().load(), useOps.getState().load(), useBilling.getState().load(), useExpenses.getState().load(), useMessages.getState().load(), usePlatform.getState().load(), useLabels.getState().load()]);
          return true;
        } catch (e) {
          toast.error("Could not load your data", { description: e instanceof Error ? e.message : undefined });
          set({ hydrated: true });
          return false;
        }
      },

      signOut: async () => {
        await supabase().auth.signOut();
        set({ ...signedOut, hydrated: true });
      },

      completeSetup: () => {
        set({ setupDone: true });
        const id = get().tenantId;
        background((sb) => run(sb.from("tenants").update({ setup_done: true }).eq("id", id), "Finishing setup"));
      },

      updateTenant: (patch) => {
        set((s) => ({ tenant: { ...s.tenant, ...patch } }));
        // Settings save as you type, so wait for a pause before writing.
        clearTimeout(tenantTimer);
        tenantTimer = setTimeout(() => {
          const { tenant, tenantId } = get();
          if (tenantId) background((sb) => run(sb.from("tenants").update(tenantRow(tenant)).eq("id", tenantId), "Saving settings"));
        }, 700);
      },

      uploadMedia: async (file, name) => {
        const path = `${get().tenantId}/${uid()}-${name.replace(/[^\w.-]/g, "_")}`;
        const res = await supabase().storage.from("media").upload(path, file, { contentType: file.type || undefined });
        if (res.error) throw new Error(res.error.message);
        return path;
      },

      setLocale: (locale) => set({ locale }),
      setBranch: async (branchId) => {
        set({ branchPref: branchId });
        await get().reload();
      },
      setViewAs: (viewAs) => set({ viewAs }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      addUser: (user) => {
        const invite = { ...user, id: uid(), invited: true };
        set((s) => ({ users: [...s.users, invite] }));
        background((sb) => run(sb.from("team_invites").insert({ id: invite.id, name: invite.name, phone: invite.phone, role: invite.role }), "Saving the invite"));
      },
      removeUser: (id) => {
        set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
        background((sb) => run(sb.from("team_invites").delete().eq("id", id), "Removing the invite"));
      },

      ensureClient: (name, phone, id) => {
        const s = get();
        const existing = s.clients.find((c) => c.id === id) ?? s.clients.find((c) => phone && c.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""));
        if (existing) return existing.id;
        const client: Client = { id: uid(), name: name.trim() || "New client", phone, type: "retail", tags: [], language: "en" };
        set({ clients: [...s.clients, client] });
        background((sb) => run(sb.from("clients").insert(clientRow(client)), "Saving the client"));
        return client.id;
      },

      saveClient: (client) => {
        // Referral code, credit and referrer change only through referrals, never from an edit form left open.
        set((s) => ({ clients: s.clients.map((c) => (c.id === client.id ? { ...client, referralCode: c.referralCode, credit: c.credit, referredBy: c.referredBy } : c)) }));
        background((sb) => run(sb.from("clients").update(clientRow(client)).eq("id", client.id), "Saving the client"));
      },

      saveEnquiry: (enquiry) => {
        const id = enquiry.id ?? uid();
        const saved: Enquiry = { ...enquiry, id, createdAt: get().enquiries.find((e) => e.id === id)?.createdAt ?? today() };
        set((s) => ({ enquiries: enquiry.id ? s.enquiries.map((e) => (e.id === id ? saved : e)) : [saved, ...s.enquiries] }));
        // A new enquiry is filed under the branch being shown; editing one never moves it.
        background((sb) => run(sb.from("enquiries").upsert(enquiry.id ? enquiryRow(saved) : withBranch(enquiryRow(saved))), "Saving the enquiry"));
        return id;
      },
      moveEnquiry: (id, stage, lostReason) => {
        const reason = stage === "lost" ? lostReason : undefined;
        set((s) => ({ enquiries: s.enquiries.map((e) => (e.id === id ? { ...e, stage, lostReason: reason } : e)) }));
        background((sb) => run(sb.from("enquiries").update({ stage, lost_reason: reason ?? null }).eq("id", id), "Moving the enquiry"));
      },

      saveItem: (item) => {
        const saved: MenuItem = { ...item, id: item.id ?? uid() };
        set((s) => ({ items: item.id ? s.items.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...s.items] }));
        background((sb) => run(sb.from("menu_items").upsert(itemRow(saved)), "Saving the dish"));
      },
      patchItems: (ids, patch) => {
        set((s) => ({ items: s.items.map((i) => (ids.includes(i.id) ? { ...i, ...patch } : i)) }));
        const changed = get().items.filter((i) => ids.includes(i.id));
        background((sb) => run(sb.from("menu_items").upsert(changed.map(itemRow)), "Saving the menu"));
      },
      raisePrices: (ids, pct) => {
        set((s) => ({ items: s.items.map((i) => (ids.includes(i.id) ? { ...i, price: Math.round(i.price * (1 + pct / 100)) } : i)) }));
        const changed = get().items.filter((i) => ids.includes(i.id));
        background((sb) => run(sb.from("menu_items").upsert(changed.map(itemRow)), "Saving prices"));
      },
      restoreItems: (snapshot) => {
        const current = new Map(get().items.map((i) => [i.id, i]));
        const changed = snapshot.filter((i) => JSON.stringify(current.get(i.id)) !== JSON.stringify(i));
        set({ items: snapshot });
        if (changed.length) background((sb) => run(sb.from("menu_items").upsert(changed.map(itemRow)), "Undoing the change"));
      },
      savePackage: (pkg) => {
        const saved: MenuPackage = { ...pkg, id: pkg.id ?? uid() };
        set((s) => ({ packages: pkg.id ? s.packages.map((p) => (p.id === saved.id ? saved : p)) : [...s.packages, saved] }));
        background((sb) => savePackageRows(sb, saved));
      },
      saveCategory: (category) => {
        const s = get();
        const id = category.id ?? uid();
        const saved: MenuCategory = { id, name: category.name, icon: category.icon, parentId: category.parentId };
        const exists = s.categories.some((c) => c.id === id);
        const moved = exists && s.categories.find((c) => c.id === id)?.parentId !== saved.parentId;
        // A new sub-category goes at the end of its parent's branch; the list stays in tree order.
        let list = exists ? s.categories.map((c) => (c.id === id ? saved : c)) : [...s.categories, saved];
        if (!exists || moved) list = treeOrder(list).map((x) => x.c);
        set({ categories: list });
        const changed = !exists || moved ? list : [saved];
        background((sb) => run(sb.from("menu_categories").upsert(changed.map((c) => categoryRow(c, list.findIndex((x) => x.id === c.id)))), "Saving the category"));
        return id;
      },
      reorderCategories: (ids) => {
        const s = get();
        const list = ids.map((id) => s.categories.find((c) => c.id === id)).filter((c): c is MenuCategory => !!c);
        set({ categories: list });
        background((sb) => run(sb.from("menu_categories").upsert(list.map((c, i) => categoryRow(c, i))), "Saving the order"));
      },
      deleteCategory: async (id, moveDishesTo) => {
        const s = get();
        const moving = s.items.filter((i) => i.categoryId === id);
        if (moving.length && !moveDishesTo) throw new Error("Move its dishes to another category first.");
        // Its sub-categories move up to take its place.
        const parentId = s.categories.find((c) => c.id === id)?.parentId;
        const children = s.categories.filter((c) => c.parentId === id);
        await write(async (sb) => {
          if (moving.length) await run(sb.from("menu_items").update({ category_id: moveDishesTo }).eq("category_id", id), "Moving the dishes");
          if (children.length) await run(sb.from("menu_categories").update({ parent_id: parentId ?? null }).eq("parent_id", id), "Moving the sub-categories");
          await run(sb.from("menu_categories").delete().eq("id", id), "Deleting the category");
        });
        set((st) => ({
          categories: st.categories.filter((c) => c.id !== id).map((c) => (c.parentId === id ? { ...c, parentId } : c)),
          items: st.items.map((i) => (i.categoryId === id ? { ...i, categoryId: moveDishesTo! } : i)),
          packages: st.packages.map((p) => ({ ...p, rules: p.rules.filter((r) => r.categoryId !== id) })),
        }));
        // The owner's food types stop listing it too (only the owner can change account settings).
        const types = get().tenant.foodTypes;
        if (get().myRole === "owner" && types?.some((t) => t.categoryIds.includes(id))) get().updateTenant({ foodTypes: types.map((t) => ({ ...t, categoryIds: t.categoryIds.filter((x) => x !== id) })) });
      },
      removePackage: (id) => {
        const s = get();
        const used = [...s.quotations, ...s.orders].some((x) => x.functions.some((f) => f.packageId === id));
        if (used) {
          set({ packages: s.packages.map((p) => (p.id === id ? { ...p, archived: true } : p)) });
          background((sb) => run(sb.from("packages").update({ archived: true }).eq("id", id), "Archiving the package"));
          return "archived";
        }
        set({ packages: s.packages.filter((p) => p.id !== id) });
        background((sb) => run(sb.from("packages").delete().eq("id", id), "Deleting the package"));
        return "deleted";
      },

      // Drafts stay on this device until they become a quotation.
      saveDraft: (key, draft) =>
        set((s) => {
          const drafts = { ...s.drafts };
          if (draft) drafts[key] = { ...draft, savedAt: new Date().toISOString() };
          else delete drafts[key];
          return { drafts };
        }),

      createQuotation: async (draft, status) => {
        const clientId = get().ensureClient(draft.clientName, draft.clientPhone, draft.clientId);
        const s = get();
        const previous = s.quotations.find((q) => q.id === draft.reviseOf);
        const id = uid();
        const enquiryId = draft.enquiryId ?? previous?.enquiryId;
        const moveEnquiry = s.enquiries.some((e) => e.id === enquiryId && ["new", "contacted", "followup"].includes(e.stage));
        const quotation = await write(async (sb) => {
          const q: Quotation = {
            id,
            // A revision keeps the number and bumps the version; only the latest stays active.
            number: previous ? previous.number : docNo(s.tenant.quotePrefix, await nextNumber(sb, "quote")),
            groupId: previous?.groupId ?? id,
            // A revision follows the newest version in its group, wherever it was started from, so two
            // revisions of the same quotation never take the same version number.
            version: previous ? (await latestVersion(sb, previous.groupId)) + 1 : 1,
            clientId,
            enquiryId,
            eventType: draft.eventType,
            // Fresh ids: a function row belongs to exactly one quotation version or order.
            functions: draft.functions.map((f) => ({ ...f, id: uid() })),
            extras: draft.extras.filter((e) => e.label && e.amount).map((e) => ({ ...e, id: uid() })),
            discount: draft.discount,
            gstRate: s.tenant.gstRate,
            gstInclusive: s.tenant.gstInclusive,
            status,
            validUntil: isoDate(addDays(new Date(), 15)),
            notes: "",
            createdBy: s.currentUserId,
            createdAt: today(),
            referralCode: draft.referralCode?.trim().toUpperCase() || undefined,
            creditUsed: draft.creditUsed || 0,
          };
          await insertQuotation(sb, q);
          if (previous) await run(sb.from("quotations").update({ status: "superseded" }).eq("group_id", previous.groupId).neq("id", id), "Closing the older version");
          if (moveEnquiry) await run(sb.from("enquiries").update({ stage: "quoted" }).eq("id", enquiryId!), "Updating the enquiry");
          return q;
        });
        set((st) => ({
          quotations: [quotation, ...st.quotations.map((q) => (previous && q.groupId === previous.groupId ? { ...q, status: "superseded" as const } : q))],
          enquiries: st.enquiries.map((e) => (moveEnquiry && e.id === enquiryId ? { ...e, stage: "quoted" as const } : e)),
        }));
        return id;
      },
      setQuoteStatus: (id, status) => {
        set((s) => ({ quotations: s.quotations.map((q) => (q.id === id ? { ...q, status } : q)) }));
        background((sb) => run(sb.from("quotations").update({ status }).eq("id", id), "Updating the quotation"));
      },

      convertToOrder: async (quoteId) => {
        const s = get();
        const q = s.quotations.find((x) => x.id === quoteId)!;
        const existing = s.orders.find((o) => o.quotationId === quoteId);
        if (existing) return existing.id;
        // The plan's monthly event limit; 0 or no plan means no limit.
        const plan = usePlatform.getState().plans.find((p) => p.id === s.tenant.subscription?.planId);
        if (plan?.eventsPerMonth && eventsThisMonth() >= plan.eventsPerMonth) throw new Error(`Your ${plan.name} plan includes ${plan.eventsPerMonth} bookings a month and they are used up. Upgrade from Settings, Plan and billing.`);
        const order = await write(async (sb) => {
          const o: Order = {
            id: uid(),
            number: docNo(s.tenant.orderPrefix, await nextNumber(sb, "order")),
            quotationId: q.id,
            clientId: q.clientId,
            eventType: q.eventType,
            functions: q.functions.map((f) => ({ ...f, id: uid() })),
            extras: q.extras.map((e) => ({ ...e, id: uid() })),
            discount: q.discount,
            gstRate: q.gstRate,
            gstInclusive: q.gstInclusive,
            status: "tentative",
            payments: [],
            changeLog: [],
            instructions: "",
            managerId: s.users.find((u) => u.role === "operations" && !u.invited)?.id ?? s.currentUserId,
            commissionPct: 0,
            createdAt: today(),
            referralCode: q.referralCode,
            creditUsed: q.creditUsed || 0,
          };
          await insertOrder(sb, o);
          // Booking spends the client's referral credit, and ties a referred client to whoever referred them.
          const client = s.clients.find((c) => c.id === q.clientId);
          const referrer = referrerOf(s.clients, q.referralCode, q.clientId);
          if (client && (o.creditUsed || (referrer && !client.referredBy)))
            await run(sb.from("clients").update({ ...(o.creditUsed ? { credit: Math.max(0, (client.credit ?? 0) - o.creditUsed) } : {}), ...(referrer && !client.referredBy ? { referred_by: referrer.id } : {}) }).eq("id", client.id), "Updating the client");
          await run(sb.from("quotations").update({ status: "approved" }).eq("id", quoteId), "Updating the quotation");
          if (q.enquiryId) await run(sb.from("enquiries").update({ stage: "booked" }).eq("id", q.enquiryId), "Updating the enquiry");
          return o;
        });
        const referrer = referrerOf(s.clients, q.referralCode, q.clientId);
        set((st) => ({
          clients: st.clients.map((c) => (c.id === q.clientId ? { ...c, credit: Math.max(0, (c.credit ?? 0) - (order.creditUsed ?? 0)), referredBy: c.referredBy ?? referrer?.id } : c)),
          orders: [order, ...st.orders],
          quotations: st.quotations.map((x) => (x.id === quoteId ? { ...x, status: "approved" as const } : x)),
          enquiries: st.enquiries.map((e) => (e.id === q.enquiryId ? { ...e, stage: "booked" as const } : e)),
        }));
        return order.id;
      },

      addPayment: async (orderId, amount, mode, note) => {
        const s = get();
        // The first payment on a tentative order is the booking advance, which confirms it.
        const order = s.orders.find((o) => o.id === orderId);
        const confirms = order?.status === "tentative";
        // Confirming a booking that came in on a referral code credits the client who shared the code, once.
        const reward = s.tenant.referral?.enabled ? s.tenant.referral.reward : 0;
        const referrer = confirms && reward > 0 && !order?.referralRewarded ? referrerOf(s.clients, order?.referralCode, order?.clientId) : undefined;
        const payment = await write(async (sb) => {
          const p: Payment = { id: uid(), amount, mode, note, date: today(), receiptNo: docNo("RCT", await nextNumber(sb, "receipt")) };
          await run(sb.from("payments").insert(paymentRow(p, orderId, s.currentUserId)), "Recording the payment");
          if (confirms) await run(sb.from("orders").update({ status: "confirmed", ...(referrer ? { referral_rewarded: true } : {}) }).eq("id", orderId), "Confirming the order");
          if (referrer) await run(sb.from("clients").update({ credit: (referrer.credit ?? 0) + reward }).eq("id", referrer.id), "Crediting the referral");
          return p;
        });
        set((st) => ({
          orders: st.orders.map((o) => (o.id === orderId ? { ...o, payments: [...o.payments, payment], status: confirms ? "confirmed" : o.status, referralRewarded: o.referralRewarded || !!referrer } : o)),
          clients: referrer ? st.clients.map((c) => (c.id === referrer.id ? { ...c, credit: (c.credit ?? 0) + reward } : c)) : st.clients,
        }));
        if (referrer) toast.success(`${referrer.name} earned ${money(reward)} referral credit`);
        // A confirmed order drafts its third-party food orders straight away.
        if (confirms) void useSupply.getState().draftOutsource(orderId).catch(() => undefined);
        return payment;
      },
      setOrderStatus: (id, status, cancelNote) => {
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status, cancelNote } : o)) }));
        background((sb) => run(sb.from("orders").update({ status, cancel_note: cancelNote ?? null }).eq("id", id), "Updating the order"));
      },
      patchOrder: (id, patch) => {
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
        const row = { ...(patch.instructions !== undefined ? { instructions: patch.instructions } : {}), ...(patch.commissionPct !== undefined ? { commission_pct: patch.commissionPct } : {}) };
        background((sb) => run(sb.from("orders").update(row).eq("id", id), "Saving the order"));
      },
      addOrderExtra: (orderId, label, amount) => {
        const extra = { id: uid(), label, amount };
        set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, extras: [...o.extras, extra] } : o)) }));
        background((sb) => run(sb.from("extra_charges").insert({ id: extra.id, order_id: orderId, label, amount }), "Adding the charge"));
      },
      changePax: (orderId, functionId, pax, priceImpact) => {
        const s = get();
        const fn = s.orders.find((o) => o.id === orderId)?.functions.find((f) => f.id === functionId);
        if (!fn || fn.pax === pax) return;
        const entry = { id: uid(), at: today(), by: s.users.find((u) => u.id === s.currentUserId)?.name ?? "", text: `${fn.name} guests changed from ${fn.pax} to ${pax}`, priceImpact };
        set((st) => ({
          orders: st.orders.map((o) => (o.id === orderId ? { ...o, functions: o.functions.map((f) => (f.id === functionId ? { ...f, pax } : f)), changeLog: [entry, ...o.changeLog] } : o)),
        }));
        background(async (sb) => {
          await run(sb.from("event_functions").update({ pax }).eq("id", functionId), "Saving the guest count");
          await run(sb.from("order_changes").insert({ id: entry.id, order_id: orderId, description: entry.text, price_impact: priceImpact, changed_by: s.currentUserId }), "Logging the change");
        });
      },
      setRawOverrides: (orderId, overrides) => {
        set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, rawOverrides: Object.keys(overrides).length ? overrides : undefined } : o)) }));
        background((sb) => run(sb.from("orders").update({ raw_overrides: overrides }).eq("id", orderId), "Saving the raw material"));
      },
      setOrderItemPrice: (orderId, functionId, itemId, price, priceImpact) => {
        const s = get();
        const fn = s.orders.find((o) => o.id === orderId)?.functions.find((f) => f.id === functionId);
        const item = s.items.find((i) => i.id === itemId);
        if (!fn || !item) return;
        const before = fn.itemPrices?.[itemId] ?? item.price;
        if (before === (price ?? item.price)) return;
        const prices = { ...fn.itemPrices };
        if (price === undefined) delete prices[itemId];
        else prices[itemId] = price;
        const entry = { id: uid(), at: today(), by: s.users.find((u) => u.id === s.currentUserId)?.name ?? "", text: `${fn.name}: ${item.name} per plate changed from ${money(before)} to ${money(price ?? item.price)}`, priceImpact };
        set((st) => ({
          orders: st.orders.map((o) => (o.id === orderId ? { ...o, functions: o.functions.map((f) => (f.id === functionId ? { ...f, itemPrices: Object.keys(prices).length ? prices : undefined } : f)), changeLog: [entry, ...o.changeLog] } : o)),
        }));
        background(async (sb) => {
          await run(sb.from("function_items").update({ price_override: price ?? null }).eq("function_id", functionId).eq("item_id", itemId), "Saving the dish price");
          await run(sb.from("order_changes").insert({ id: entry.id, order_id: orderId, description: entry.text, price_impact: priceImpact, changed_by: s.currentUserId }), "Logging the change");
        });
      },
      ensureReferralCode: (clientId) => {
        const s = get();
        const client = s.clients.find((c) => c.id === clientId);
        if (!client) return "";
        if (client.referralCode) return client.referralCode;
        const code = makeReferralCode(client.name, new Set(s.clients.map((c) => c.referralCode?.toUpperCase()).filter((x): x is string => !!x)));
        set((st) => ({ clients: st.clients.map((c) => (c.id === clientId ? { ...c, referralCode: code } : c)) }));
        background((sb) => run(sb.from("clients").update({ referral_code: code }).eq("id", clientId), "Saving the referral code"));
        return code;
      },
    }),
    {
      name: "catering-prefs-v1",
      skipHydration: true,
      // Only preferences and unfinished drafts live in the browser; everything else is in Supabase.
      partialize: (s) => ({ locale: s.locale, sidebarCollapsed: s.sidebarCollapsed, drafts: s.drafts, branchPref: s.branchPref }),
    },
  ),
);

setReload(() => void useStore.getState().reload());
// Pricing and grouping read the category tree outside React, so it follows the store.
useStore.subscribe((s, prev) => {
  if (s.categories !== prev.categories) setCategoryTree(s.categories);
});

/** The highest version saved so far for a quotation, read from the database at the moment of saving. */
async function latestVersion(sb: SupabaseClient, groupId: string) {
  const res = await sb.from("quotations").select("version").eq("group_id", groupId).order("version", { ascending: false }).limit(1);
  if (res.error) throw new Error(res.error.message);
  return (res.data?.[0]?.version as number | undefined) ?? 1;
}

/** The client whose code this is, unless it is the client's own. */
export function referrerOf(clients: Client[], code: string | undefined, selfId?: string) {
  const c = code?.trim().toUpperCase();
  return c ? clients.find((x) => x.referralCode?.toUpperCase() === c && x.id !== selfId) : undefined;
}

/** RAJESH25: the first name in capitals and two digits, different from every code already given out. */
function makeReferralCode(name: string, taken: Set<string>) {
  const stem = (name.split(" ")[0] ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "FRIEND";
  for (let i = 0; i < 200; i++) {
    const code = `${stem}${10 + Math.floor(Math.random() * 90)}`;
    if (!taken.has(code)) return code;
  }
  return `${stem}${Date.now() % 100000}`;
}

const nobody: TeamUser = { id: "", name: "", phone: "", role: "owner" };

/** The signed-in user. `role` follows the owner's "view as" preview when one is set. */
export function useCurrentUser(): TeamUser {
  const user = useStore((s) => s.users.find((u) => u.id === s.currentUserId));
  const role = useStore((s) => s.viewAs ?? s.myRole);
  return React.useMemo(() => ({ ...(user ?? nobody), role }), [user, role]);
}

export function useClient(id?: string) {
  return useStore((s) => s.clients.find((c) => c.id === id));
}
