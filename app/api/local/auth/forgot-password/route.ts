import { passwordResetTokenFor } from "@/lib/local/auth";
import { mailSettings, sendEmail } from "@/lib/local/email";

const cooldown = new Map<string, number>();

export async function POST(request: Request) {
  const settings = mailSettings();
  if (!settings) return Response.json({ error: "Password recovery email is currently unavailable." }, { status: 503 });
  const result = () => Response.json({ message: "Request received", localOutbox: Boolean(settings.outbox) });
  const body = await request.json().catch(() => null);
  const email = typeof body?.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s,@<>;]+@[^\s,@<>;]+\.[^\s,@<>;]+$/.test(email) || email.endsWith(".invalid")) return result();
  const account = await passwordResetTokenFor(email);
  if (!account) return result();
  const now = Date.now();
  for (const [address, until] of cooldown) if (until <= now) cooldown.delete(address);
  if (cooldown.has(email)) return result();
  cooldown.set(email, now + 60_000);
  const link = new URL("/reset-password", settings.origin);
  link.searchParams.set("token", account.token);
  try {
    await sendEmail(settings, {
      to: account.email,
      subject: "Reset your Plan A Track password",
      text: `Use this link within 15 minutes to choose a new password.\n\n${link.href}\n\nIf you did not request this change, you can ignore this email.`,
    });
  } catch {
    cooldown.delete(email);
    console.error("Password recovery email delivery failed");
  }
  return result();
}
