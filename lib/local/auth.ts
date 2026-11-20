import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { adminPool } from "./database";

export interface LocalUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  created_at?: string;
  last_sign_in_at?: string | null;
}

const secret = () => {
  const value = process.env.LOCAL_AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("LOCAL_AUTH_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(value);
};

const shape = (row: Record<string, unknown>): LocalUser => ({
  id: String(row.id), email: String(row.email ?? ""), user_metadata: (row.raw_user_meta_data as Record<string, unknown>) ?? {},
  created_at: row.created_at ? String(row.created_at) : undefined, last_sign_in_at: row.last_sign_in_at ? String(row.last_sign_in_at) : null,
});

const loginEmail = (value: string) => {
  const login = value.trim().toLowerCase();
  return login.includes("@") ? login : `${login}@staff.invalid`;
};

const passwordVersion = (hash: string) => createHash("sha256").update(hash).digest("hex");

const sameVersion = (left: string, right: unknown) => {
  if (typeof right !== "string" || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
};

export async function tokenFor(user: LocalUser, purpose = "session", duration = "7d") {
  return new SignJWT({ email: user.email, user_metadata: user.user_metadata, purpose })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime(duration).sign(secret());
}

export async function userFromToken(token: string, purpose = "session") {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== purpose || !payload.sub) return null;
    const result = await adminPool.query("select id,email,raw_user_meta_data,created_at,last_sign_in_at from auth.users where id=$1", [payload.sub]);
    return result.rows[0] ? shape(result.rows[0]) : null;
  } catch { return null; }
}

export async function authenticate(email: string, password: string) {
  const result = await adminPool.query("select * from auth.users where lower(email)=lower($1)", [email]);
  const row = result.rows[0];
  if (!row?.encrypted_password || !(await bcrypt.compare(password, row.encrypted_password))) return null;
  await adminPool.query("update auth.users set last_sign_in_at=now(), updated_at=now() where id=$1", [row.id]);
  return shape({ ...row, last_sign_in_at: new Date().toISOString() });
}

/** A short-lived link for local password recovery. The password hash fingerprint makes it one-use. */
export async function passwordResetTokenFor(identifier: string) {
  const result = await adminPool.query("select id,email,raw_user_meta_data,encrypted_password from auth.users where lower(email)=lower($1)", [loginEmail(identifier)]);
  const row = result.rows[0];
  if (!row?.encrypted_password) return null;
  const user = shape(row);
  const token = await new SignJWT({ purpose: "password-reset", password_version: passwordVersion(row.encrypted_password) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
  return { token, email: user.email };
}

/** Changes the password only if the reset link is valid and has not already been used. */
export async function resetPasswordWithToken(token: string, password: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "password-reset" || !payload.sub) return false;
    const current = await adminPool.query("select encrypted_password from auth.users where id=$1", [payload.sub]);
    const encrypted = current.rows[0]?.encrypted_password;
    if (!encrypted || !sameVersion(passwordVersion(encrypted), payload.password_version)) return false;
    const next = await bcrypt.hash(password, 12);
    const updated = await adminPool.query(
      "update auth.users set encrypted_password=$1,updated_at=now() where id=$2 and encrypted_password=$3",
      [next, payload.sub, encrypted],
    );
    return updated.rowCount === 1;
  } catch {
    return false;
  }
}

export async function createUser(input: { email: string; password: string; user_metadata?: Record<string, unknown> }) {
  try {
    const id = randomUUID();
    const password = await bcrypt.hash(input.password, 12);
    const result = await adminPool.query(
      "insert into auth.users(id,email,encrypted_password,raw_user_meta_data,email_confirmed_at) values($1,lower($2),$3,$4,now()) returning *",
      [id, input.email, password, JSON.stringify(input.user_metadata ?? {})],
    );
    return { data: { user: shape(result.rows[0]) }, error: null };
  } catch (error) {
    return { data: { user: null }, error: { message: error instanceof Error ? error.message : "Could not create user." } };
  }
}

export async function deleteUser(id: string) {
  try { await adminPool.query("delete from auth.users where id=$1", [id]); return { data: {}, error: null }; }
  catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : "Could not delete user." } }; }
}

export async function updateUser(id: string, input: { password?: string; user_metadata?: Record<string, unknown> }) {
  try {
    if (input.password) await adminPool.query("update auth.users set encrypted_password=$2,updated_at=now() where id=$1", [id, await bcrypt.hash(input.password, 12)]);
    if (input.user_metadata) await adminPool.query("update auth.users set raw_user_meta_data=$2,updated_at=now() where id=$1", [id, JSON.stringify(input.user_metadata)]);
    const result = await adminPool.query("select * from auth.users where id=$1", [id]);
    return { data: { user: result.rows[0] ? shape(result.rows[0]) : null }, error: null };
  } catch (error) { return { data: { user: null }, error: { message: error instanceof Error ? error.message : "Could not update user." } }; }
}

export async function getUser(id: string) {
  const result = await adminPool.query("select * from auth.users where id=$1", [id]);
  return result.rows[0] ? shape(result.rows[0]) : null;
}

export async function listUsers() {
  const result = await adminPool.query("select * from auth.users order by created_at");
  return result.rows.map(shape);
}
