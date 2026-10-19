import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Creates a Razorpay payment link for part of an order's balance. The caller's own login is used to
 * read the order, so row-level security decides whether they may bill it. The keys never reach the browser.
 */
export async function POST(request: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return NextResponse.json({ error: "Online payments are not set up yet. Add the Razorpay keys to the server settings." }, { status: 501 });

  const auth = request.headers.get("authorization") ?? "";
  const body = (await request.json().catch(() => null)) as { orderId?: string; amount?: number } | null;
  const amount = Math.round(Number(body?.amount) * 100);
  if (!auth.startsWith("Bearer ") || !body?.orderId || !(amount >= 100)) return NextResponse.json({ error: "Send an order and an amount of at least ₹1." }, { status: 400 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: order } = await sb.from("orders").select("id, number, event_type, tenant_id, clients(name, phone)").eq("id", body.orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const client = (Array.isArray(order.clients) ? order.clients[0] : order.clients) as { name: string; phone: string } | null;

  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` },
    body: JSON.stringify({
      amount,
      currency: "INR",
      description: `${order.event_type} ${order.number}`.slice(0, 2048),
      customer: { name: client?.name ?? "", contact: client?.phone ? `+91${client.phone.replace(/\D/g, "").slice(-10)}` : undefined },
      notify: { sms: false, email: false },
      reminder_enable: true,
      // Read back by the webhook to know whose payment it is.
      notes: { tenant_id: order.tenant_id, order_id: order.id },
    }),
  });
  const link = (await res.json().catch(() => null)) as { short_url?: string; id?: string; error?: { description?: string } } | null;
  if (!res.ok || !link?.short_url) return NextResponse.json({ error: link?.error?.description ?? "Razorpay did not create the link." }, { status: 502 });
  return NextResponse.json({ url: link.short_url, id: link.id });
}
