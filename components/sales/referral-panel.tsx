"use client";

import { Copy, Gift, MessageCircle, Ticket } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Client } from "@/lib/types";
import { money, whatsappLink } from "@/lib/utils";
import { offerText } from "./summary-extras";

/** A client's referral code to share, their credit, and the people who came in on it. */
export function ReferralPanel({ client }: { client: Client }) {
  const ready = useStore((s) => s.referralsReady);
  const tenant = useStore((s) => s.tenant);
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const ensureReferralCode = useStore((s) => s.ensureReferralCode);
  const live = clients.find((c) => c.id === client.id) ?? client;
  const code = live.referralCode;

  // Every client has a code; one made before referrals existed gets it the first time it is opened.
  React.useEffect(() => {
    if (ready && !code) ensureReferralCode(client.id);
  }, [ready, code, client.id, ensureReferralCode]);

  if (!ready || !code) return null;
  const offer = tenant.referral?.enabled ? tenant.referral : undefined;
  const link = tenant.publicSlug && tenant.publicMenu ? `${window.location.origin}/m/${tenant.publicSlug}?ref=${code}` : "";
  const message = [
    `Namaste ${live.name.split(" ")[0]}, thank you for choosing ${tenant.name}.`,
    `Your referral code is ${code}.${offer ? ` Friends who book with it get ${offerText(offer)}${offer.reward ? `, and you get ${money(offer.reward)} credit on your next booking` : ""}.` : ""}`,
    link ? `Share this link: ${link}` : "",
  ].filter(Boolean).join("\n");
  const referred = clients.filter((c) => c.referredBy === client.id);
  const pending = orders.filter((o) => o.referralCode?.toUpperCase() === code.toUpperCase() && o.clientId !== client.id && !referred.some((c) => c.id === o.clientId));

  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-base font-semibold"><Ticket className="size-4 text-primary" strokeWidth={1.75} />Referral code</h3>
          <p className="tnum mt-1 font-heading text-2xl font-bold tracking-wider">{code}</p>
          <p className="text-xs text-text-muted">{offer ? `Friends get ${offerText(offer)}${offer.reward ? `; ${live.name.split(" ")[0]} earns ${money(offer.reward)} credit per booking` : ""}.` : "Set the referral offer in Settings, Referrals."}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">Credit to use</p>
          <p className="tnum flex items-center justify-end gap-1.5 font-heading text-2xl font-bold text-accent-gold"><Gift className="size-5" strokeWidth={1.75} />{money(live.credit ?? 0)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild><a href={whatsappLink(live.phone, message)} target="_blank" rel="noreferrer"><MessageCircle strokeWidth={1.75} />Share on WhatsApp</a></Button>
        <Button variant="ghost" onClick={() => { void navigator.clipboard?.writeText(link || code); toast.success(link ? "Link copied" : "Code copied"); }}><Copy strokeWidth={1.75} />{link ? "Copy link" : "Copy code"}</Button>
      </div>
      {!link && <p className="mt-2 text-xs text-text-muted">Turn on the public menu in Settings to share a link along with the code.</p>}
      {(referred.length > 0 || pending.length > 0) && (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-medium text-text-muted">Referred</p>
          <ul className="mt-1 space-y-1 text-sm">
            {referred.map((c) => <li key={c.id}>{c.name}</li>)}
            {pending.map((o) => <li key={o.id}>{clients.find((c) => c.id === o.clientId)?.name} <span className="text-xs text-text-muted">· {o.referralRewarded ? "credited" : "credit after the advance"}</span></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
