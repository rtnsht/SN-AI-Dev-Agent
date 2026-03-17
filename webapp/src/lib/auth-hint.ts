import crypto from "crypto";

const AUTH_HINT_TTL_SECONDS = 300;
const AUTH_HINT_COOKIE_NAME = "auth_hint";
const HMAC_HEX_RE = /^[a-f0-9]{64}$/i;

export type AuthHintResult = "known" | "unknown";

function getAuthHintSecret(): string {
  const secret = process.env.AUTH_HINT_SECRET;
  if (!secret) {
    throw new Error("AUTH_HINT_SECRET is required");
  }
  return secret;
}

function signPayload(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function safeSigEquals(expectedHex: string, providedHex: string): boolean {
  if (!HMAC_HEX_RE.test(expectedHex) || !HMAC_HEX_RE.test(providedHex)) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
}

export function isAuthHintConfigured(): boolean {
  return !!process.env.AUTH_HINT_SECRET;
}

/** Value format: result.issuedAtMs.nonce.signatureHex */
export function createAuthHintValue(result: AuthHintResult): string {
  const secret = getAuthHintSecret();
  const issuedAtMs = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${result}.${issuedAtMs}.${nonce}`;
  const signature = signPayload(secret, payload);
  return `${payload}.${signature}`;
}

export function verifyAuthHintValue(value: string): { result: AuthHintResult } | null {
  const secret = getAuthHintSecret();
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const [result, issuedAtRaw, nonce, providedSig] = parts;
  if (result !== "known" && result !== "unknown") {
    return null;
  }
  if (!/^\d+$/.test(issuedAtRaw) || !/^[a-f0-9]{16}$/i.test(nonce) || !HMAC_HEX_RE.test(providedSig)) {
    return null;
  }

  const issuedAtMs = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAtMs)) {
    return null;
  }
  const ageMs = Date.now() - issuedAtMs;
  if (ageMs < 0 || ageMs > AUTH_HINT_TTL_SECONDS * 1000) {
    return null;
  }

  const payload = `${result}.${issuedAtRaw}.${nonce}`;
  const expectedSig = signPayload(secret, payload);
  if (!safeSigEquals(expectedSig, providedSig)) {
    return null;
  }

  return { result };
}

export function getAuthHintSetCookie(value: string): string {
  return `${AUTH_HINT_COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=${AUTH_HINT_TTL_SECONDS}; Path=/`;
}

export function getAuthHintClearCookie(): string {
  return `${AUTH_HINT_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`;
}
