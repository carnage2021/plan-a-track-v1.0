import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Razorpay calls this when a payment link is paid. The signature proves the call came from Razorpay;
 * the payment is then recorded on the order with its own receipt number, once, however often Razorpay retries.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not set." }, { status: 501 });
  const raw = await request.text();
  const given = Buffer.from(request.headers.get("x-razorpay-signature") ?? "", "utf8");
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"), "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Bad signature." }, { status: 401 });

  const event = JSON.parse(raw) as {
    event: string;
    payload?: { payment_link?: { entity?: { notes?: { tenant_id?: string; order_id?: string } } }; payment?: { entity?: { id?: string; amount?: number } } };
  };
  // Other events (expired, cancelled) need no action; answer 200 so Razorpay stops retrying.
  if (event.event !== "payment_link.paid") return NextResponse.json({ ok: true });
  const notes = event.payload?.payment_link?.entity?.notes;
  const payment = event.payload?.payment?.entity;
  if (!notes?.tenant_id || !notes.order_id || !payment?.id || !payment.amount) return NextResponse.json({ error: "Payment details missing." }, { status: 400 });

  const { data, error } = await adminClient().rpc("record_online_payment", { p_tenant: notes.tenant_id, p_order: notes.order_id, p_amount: payment.amount / 100, p_ref: payment.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, receipt: data });
}
