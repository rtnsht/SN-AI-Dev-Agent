/**
 * Auth utilities — session management, password hashing, token generation.
 * All operations go through the server-side Supabase client.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getSupabase } from "./supabase";

const BCRYPT_COST = 12;
const SESSION_MAX_AGE_DAYS = parseInt(process.env.SESSION_MAX_AGE_DAYS || "1", 10) || 1;
const MAGIC_LINK_EXPIRY_HOURS = parseInt(process.env.MAGIC_LINK_EXPIRY_HOURS || "72", 10) || 72;
const EMAIL_VERIFY_EXPIRY_HOURS = parseInt(process.env.EMAIL_VERIFY_EXPIRY_HOURS || "24", 10) || 24;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10) || 10;
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "sn-ai-session";
const TEMP_SESSION_MINUTES = 15;

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_DAYS };

// ── Password ────────────────────────────────────────────────────

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) return { valid: false, message: "Password must be at least 8 characters" };
  if (!/[a-zA-Z]/.test(password)) return { valid: false, message: "Password must contain at least one letter" };
  if (!/[0-9]/.test(password)) return { valid: false, message: "Password must contain at least one number" };
  return { valid: true };
}

// ── Token generation ────────────────────────────────────────────

/** 96-char hex token (48 random bytes) */
export function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/** 24-char hex invite code (12 random bytes) */
export function generateInviteCode(): string {
  return crypto.randomBytes(12).toString("hex");
}

/** 6-digit zero-padded numeric OTP */
export function generateOTP(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function isMissingOtpCodeColumnError(message?: string): boolean {
  const lower = (message || "").toLowerCase();
  return lower.includes("otp_code") && (
    lower.includes("does not exist") ||
    lower.includes("could not find") ||
    lower.includes("schema cache")
  );
}

function buildLegacyOtpTokenPrefix(email: string, otp: string): string {
  const emailHash = crypto.createHash("sha256").update(email).digest("hex");
  return `otp:${emailHash}:${otp}:`;
}

function buildLegacyOtpToken(email: string, otp: string): string {
  return `${buildLegacyOtpTokenPrefix(email, otp)}${generateToken()}`;
}

// ── Session management ──────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  must_set_password: boolean;
}

export interface SessionData {
  session_id: string;
  user: SessionUser;
  is_temporary: boolean;
}

export async function createSession(
  userId: string,
  opts: { ip?: string; userAgent?: string; temporary?: boolean } = {}
): Promise<{ token: string; expiresAt: Date }> {
  const db = getSupabase();
  const token = generateToken();
  const expiresAt = opts.temporary
    ? new Date(Date.now() + TEMP_SESSION_MINUTES * 60 * 1000)
    : new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await db.from("sessions").insert({
    user_id: userId,
    token,
    is_temporary: opts.temporary || false,
    expires_at: expiresAt.toISOString(),
    ip_address: opts.ip || null,
    user_agent: opts.userAgent || null,
  });

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return { token, expiresAt };
}

export async function validateSession(token: string): Promise<SessionData | null> {
  const db = getSupabase();

  const { data: session, error } = await db
    .from("sessions")
    .select("id, user_id, is_temporary, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !session) return null;

  const { data: user, error: userErr } = await db
    .from("users")
    .select("id, email, name, role, status, must_set_password")
    .eq("id", session.user_id)
    .single();

  if (userErr || !user) return null;

  // Suspended user → kill session
  if (user.status === "suspended") {
    await deleteSession(token);
    await deleteAllUserSessions(user.id);
    return null;
  }

  return {
    session_id: session.id,
    user: user as SessionUser,
    is_temporary: session.is_temporary,
  };
}

export async function deleteSession(token: string): Promise<void> {
  const db = getSupabase();
  await db.from("sessions").delete().eq("token", token);
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  const db = getSupabase();
  await db.from("sessions").delete().eq("user_id", userId);
}

export async function upgradeSession(token: string): Promise<Date> {
  const db = getSupabase();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  await db
    .from("sessions")
    .update({ is_temporary: false, expires_at: expiresAt.toISOString() })
    .eq("token", token);
  return expiresAt;
}

// ── Auth tokens (magic links, email verify, password reset) ─────

export type TokenType = "magic_link" | "email_verify" | "password_reset";

export async function createAuthToken(
  email: string,
  type: TokenType,
  userId?: string
): Promise<{ token: string; expiresAt: Date }> {
  const db = getSupabase();
  const token = generateToken();
  const hours = type === "email_verify" ? EMAIL_VERIFY_EXPIRY_HOURS : MAGIC_LINK_EXPIRY_HOURS;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const { error } = await db.from("auth_tokens").insert({
    user_id: userId || null,
    email: email.toLowerCase().trim(),
    token,
    type,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(`Failed to create auth token: ${error.message}`);
  return { token, expiresAt };
}

export async function consumeAuthToken(
  token: string,
  expectedType?: TokenType
): Promise<{ email: string; userId: string | null; type: TokenType } | null> {
  const db = getSupabase();

  let query = db
    .from("auth_tokens")
    .select("id, email, user_id, type")
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString());

  if (expectedType) query = query.eq("type", expectedType);

  const { data, error } = await query.single();
  if (error || !data) return null;

  // Mark as used
  await db
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { email: data.email, userId: data.user_id, type: data.type as TokenType };
}

// ── OTP tokens ──────────────────────────────────────────────────

export async function createOTPToken(
  email: string
): Promise<{ otp: string; expiresAt: Date }> {
  const db = getSupabase();
  const otp = generateOTP();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const normalizedEmail = email.toLowerCase().trim();

  // OTPs are the only active email_verify tokens in the current auth flow, so
  // we can safely retire any earlier unused attempts before minting a new code.
  const { error: invalidateError } = await db
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("email", normalizedEmail)
    .eq("type", "email_verify")
    .is("used_at", null);

  if (invalidateError) {
    throw new Error(`Failed to invalidate previous OTP tokens: ${invalidateError.message}`);
  }

  const { error } = await db.from("auth_tokens").insert({
    email: normalizedEmail,
    token,
    type: "email_verify",
    otp_code: otp,
    expires_at: expiresAt.toISOString(),
  });

  if (!error) return { otp, expiresAt };

  if (!isMissingOtpCodeColumnError(error.message)) {
    throw new Error(`Failed to create OTP token: ${error.message}`);
  }

  const legacyToken = buildLegacyOtpToken(normalizedEmail, otp);
  const { error: legacyError } = await db.from("auth_tokens").insert({
    email: normalizedEmail,
    token: legacyToken,
    type: "email_verify",
    expires_at: expiresAt.toISOString(),
  });

  if (legacyError) {
    throw new Error(`Failed to create OTP token: ${legacyError.message}`);
  }

  console.warn("[auth] auth_tokens.otp_code column missing; using legacy OTP token fallback");
  return { otp, expiresAt };
}

export async function consumeOTPToken(
  email: string,
  otp: string
): Promise<{ email: string } | null> {
  const db = getSupabase();
  const normalizedEmail = email.toLowerCase().trim();
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from("auth_tokens")
    .select("id, email")
    .eq("email", normalizedEmail)
    .eq("otp_code", otp)
    .eq("type", "email_verify")
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .single();

  if (data) {
    await db
      .from("auth_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", data.id);

    return { email: data.email };
  }

  if (error && !isMissingOtpCodeColumnError(error.message)) {
    // No matching otp_code record is a normal invalid/expired-code path. In that
    // case we still check the legacy fallback format for compatibility.
  }

  const legacyPrefix = `${buildLegacyOtpTokenPrefix(normalizedEmail, otp)}%`;
  const { data: legacyData, error: legacyError } = await db
    .from("auth_tokens")
    .select("id, email")
    .eq("email", normalizedEmail)
    .eq("type", "email_verify")
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .like("token", legacyPrefix)
    .single();

  if (legacyError || !legacyData) return null;

  await db
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", legacyData.id);

  return { email: legacyData.email };
}

// ── Session cookie helpers ──────────────────────────────────────

export function sessionCookieOptions(expiresAt: Date): string {
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  const secure = process.env.NODE_ENV === "production";
  return [
    `${SESSION_COOKIE_NAME}=placeholder`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function buildSetCookieHeader(token: string, expiresAt: Date): string {
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  const secure = process.env.NODE_ENV === "production";
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function buildClearCookieHeader(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ].join("; ");
}

// ── Admin seed ──────────────────────────────────────────────────

let _seeded = false;

export async function seedAdmin(): Promise<void> {
  if (_seeded) return;

  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!email || !name || !passwordHash) {
    console.warn("[auth] Admin seed skipped — ADMIN_EMAIL, ADMIN_NAME, or ADMIN_PASSWORD_HASH is not set.");
    _seeded = true;
    return;
  }

  // Warn if password hash looks invalid
  if (!passwordHash.startsWith("$2a$") && !passwordHash.startsWith("$2b$")) {
    console.warn("[auth] WARNING: ADMIN_PASSWORD_HASH does not look like a bcrypt hash. Login will likely fail.");
  }

  const db = getSupabase();
  const normalizedEmail = email.toLowerCase().trim();

  const { data } = await db
    .from("users")
    .select("id, password_hash, name, role")
    .eq("email", normalizedEmail)
    .single();

  if (!data) {
    // Insert new admin
    const { error } = await db.from("users").insert({
      email: normalizedEmail,
      name,
      password_hash: passwordHash,
      role: "admin",
      status: "active",
      must_set_password: false,
    });
    if (error) {
      console.error("[auth] Failed to seed admin:", error.message);
    } else {
      console.log(`[auth] Admin user seeded: ${email}`);
    }
  } else {
    // Update existing admin if env vars changed
    const needsUpdate =
      data.password_hash !== passwordHash ||
      data.name !== name ||
      data.role !== "admin";

    if (needsUpdate) {
      const { error } = await db
        .from("users")
        .update({
          password_hash: passwordHash,
          name,
          role: "admin",
          status: "active",
        })
        .eq("id", data.id);

      if (error) {
        console.error("[auth] Failed to update admin:", error.message);
      } else {
        console.log(`[auth] Admin user updated from env vars: ${email}`);
      }
    }
  }

  _seeded = true;
}

