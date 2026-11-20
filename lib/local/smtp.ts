import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { adminPool } from "./database";

export interface SmtpSettings {
  revision: number;
  enabled: boolean;
  host: string;
  port: number;
  security: "starttls" | "tls" | "loopback";
  username: string;
  sender: string;
  hasPassword: boolean;
}

const columns = 'revision, enabled, host, port, security, username, sender, password_cipher is not null as "hasPassword"';

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const result = await adminPool.query<SmtpSettings>(`select ${columns} from auth.smtp_settings where singleton`);
  return result.rows[0];
}

function encryptionKey() {
  const secret = process.env.LOCAL_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Local authentication secret is unavailable.");
  return createHmac("sha256", secret).update("plan-a-track/smtp-password/v1").digest("hex");
}

export class SmtpInputError extends Error {}

export async function saveSmtpSettings(input: Partial<SmtpSettings> & { password?: string }) {
  if (!input || typeof input.enabled !== "boolean" || !Number.isInteger(input.revision) ||
      !Number.isInteger(input.port) || input.port! < 1 || input.port! > 65535 ||
      !["starttls", "tls", "loopback"].includes(input.security ?? "")) {
    throw new SmtpInputError("Check the SMTP port and connection settings.");
  }
  const { host, username, sender, password } = input;
  if (typeof host !== "string" || host.length > 253 ||
      (host && !isIP(host) && !host.split(".").every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part))) ||
      typeof sender !== "string" || sender.length > 254 || (sender && !/^[^\s,@<>;]+@[^\s,@<>;]+\.[^\s,@<>;]+$/.test(sender)) ||
      typeof username !== "string" || username.length > 320 || /[\r\n\0]/.test(username) ||
      typeof password !== "string" || password.length > 4096) {
    throw new SmtpInputError("Check the hostname, sender address and credentials.");
  }
  if (input.enabled && (!host || !sender)) throw new SmtpInputError("Enter the host and sender address before enabling SMTP.");
  if (input.security === "loopback" && (process.env.NODE_ENV !== "development" || !["127.0.0.1", "::1"].includes(host))) {
    throw new SmtpInputError("Local test mode requires a loopback IP on the development server.");
  }
  const current = await getSmtpSettings();
  if (password && !username) throw new SmtpInputError("Enter a username with the SMTP password.");
  if (username && !password && (!current.hasPassword || host !== current.host || username !== current.username || input.port !== current.port || input.security !== current.security)) {
    throw new SmtpInputError("Enter the SMTP password for this connection.");
  }
  const saved = await adminPool.query<SmtpSettings>(`update auth.smtp_settings set enabled=$1, host=$2, port=$3,
    security=$4, username=$5, sender=$6, password_cipher=case when $5='' then null
    when $7::text<>'' then pgp_sym_encrypt($7,$8) else password_cipher end, revision=revision+1
    where singleton and revision=$9 returning ${columns}`,
    [input.enabled, host, input.port, input.security, username, sender, password, password ? encryptionKey() : null, input.revision]);
  if (!saved.rowCount) throw new SmtpInputError("Settings changed. Refresh the admin panel before saving.");
  return saved.rows[0];
}

export async function activeSmtp() {
  const result = await adminPool.query<Omit<SmtpSettings, "hasPassword"> & { password: string | null }>(
    "select host, port, security, username, sender, pgp_sym_decrypt(password_cipher,$1) as password from auth.smtp_settings where singleton and enabled", [encryptionKey()]);
  return result.rows[0];
}
