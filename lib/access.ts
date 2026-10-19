"use client";

import { useCurrentUser, useStore } from "./store";
import type { Role } from "./types";

// Phase 6: what each role may open, price hiding, and approval limits (plan F3). Saved on the tenant
// (tenants.role_access, from 0009). The row-level security in each migration still applies underneath:
// these settings can narrow what a role sees, never widen what the database lets it change.

export interface RoleAccess {
  /** Nav keys this role may open; home is always allowed */
  modules: string[];
  /** Hide dish prices, costs and margins on the menu screens */
  hidePrices: boolean;
}
export interface TenantAccess {
  roles: Partial<Record<Role, RoleAccess>>;
  /** Purchase orders above this need the owner to send them; 0 means no limit */
  poLimit: number;
  /** Worker payouts and advances above this need the owner to record them; 0 means no limit */
  payoutLimit: number;
}
export const defaultAccess: TenantAccess = { roles: {}, poLimit: 0, payoutLimit: 0 };

/** The signed-in person's access, with the owner always unrestricted. */
export function useAccess() {
  const user = useCurrentUser();
  const access = useStore((s) => s.tenant.access) ?? defaultAccess;
  const owner = user.role === "owner";
  const mine = owner ? undefined : access.roles[user.role];
  return {
    access,
    owner,
    hidePrices: !!mine?.hidePrices,
    /** True when this amount is over the limit and only the owner may go ahead. */
    needsOwner: (kind: "po" | "payout", amount: number) => {
      const limit = kind === "po" ? access.poLimit : access.payoutLimit;
      return !owner && limit > 0 && amount > limit;
    },
    limit: (kind: "po" | "payout") => (kind === "po" ? access.poLimit : access.payoutLimit),
  };
}
