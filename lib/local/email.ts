import "server-only";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import nodemailer from "nodemailer";
import { activeSmtp } from "./smtp";

type Message = { to: string; subject: string; text: string };

export async function mailSettings() {
  const origin = new URL(process.env.APP_ORIGIN || "http://localhost:3000");
  const smtp = await activeSmtp();
  if (smtp) return { origin, smtp } as const;
  if (process.env.NODE_ENV === "development" && process.env.LOCAL_MAIL_OUTBOX &&
      ["localhost", "127.0.0.1"].includes(origin.hostname)) {
    return { origin, outbox: process.env.LOCAL_MAIL_OUTBOX } as const;
  }
  if (origin.protocol === "https:" && process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    return { origin, key: process.env.RESEND_API_KEY, from: process.env.MAIL_FROM } as const;
  }
  return null;
}

export async function sendEmail(settings: NonNullable<Awaited<ReturnType<typeof mailSettings>>>, message: Message) {
  if (settings.smtp) {
    const { host, port, security, username, password, sender } = settings.smtp;
    const transport = nodemailer.createTransport({
      host, port, secure: security === "tls", requireTLS: security === "starttls",
      ignoreTLS: security === "loopback",
      auth: username ? { user: username, pass: password ?? "" } : undefined,
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    await transport.sendMail({ ...message, from: sender });
    return;
  }
  if (settings.outbox) {
    await writeFile(path.join(settings.outbox, randomUUID() + ".json"), JSON.stringify(message, null, 2), { flag: "wx", mode: 0o600 });
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + settings.key, "Content-Type": "application/json" },
    body: JSON.stringify({ ...message, from: settings.from, to: [message.to] }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Mail service rejected the message");
}
