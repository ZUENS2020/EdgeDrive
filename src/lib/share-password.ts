import { bytesToHex, sha256Hex } from "./sha256";
import { timingSafeEqual } from "./timing-safe";

export const SHARE_COOKIE_PREFIX = "ed_share_";
export const SHARE_COOKIE_MAX_AGE = 30 * 60;
export const SHARE_LOCK_AFTER = 5;
export const SHARE_LOCK_MS = 10 * 60 * 1000;

export function shareCookieName(token: string): string {
  return `${SHARE_COOKIE_PREFIX}${token}`;
}

export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    let v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      v = decodeURIComponent(v);
    } catch {
      // keep raw
    }
    out[k] = v;
  }
  return out;
}

export async function hashSharePassword(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = bytesToHex(saltBytes);
  const hash = await sha256Hex(new TextEncoder().encode(`${salt}:${password}`));
  return `${salt}:${hash}`;
}

export async function verifySharePassword(stored: string, password: string): Promise<boolean> {
  const idx = stored.indexOf(":");
  const salt = idx > 0 ? stored.slice(0, idx) : "0".repeat(32);
  const expected = idx > 0 ? stored.slice(idx + 1) : "0".repeat(64);
  const actual = await sha256Hex(new TextEncoder().encode(`${salt}:${password}`));
  if (idx <= 0) return false;
  return timingSafeEqual(actual, expected);
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return bytesToHex(sig);
}

export async function mintUnlockCookie(passwordHash: string, token: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + SHARE_COOKIE_MAX_AGE;
  const mac = await hmacSha256Hex(passwordHash, `${token}|${exp}`);
  return `${exp}.${mac}`;
}

export async function verifyUnlockCookie(
  passwordHash: string,
  token: string,
  raw: string,
  now = Date.now(),
): Promise<boolean> {
  const idx = raw.indexOf(".");
  if (idx <= 0) return false;
  const expRaw = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = await hmacSha256Hex(passwordHash, `${token}|${expRaw}`);
  return timingSafeEqual(mac, expected);
}

export function serializeShareCookie(opts: {
  token: string;
  value: string;
  secure: boolean;
  maxAge?: number;
}): string {
  const parts = [
    `${shareCookieName(opts.token)}=${encodeURIComponent(opts.value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAge ?? SHARE_COOKIE_MAX_AGE}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function isShareLocked(lockedUntil: string | null, now = Date.now()): boolean {
  if (!lockedUntil) return false;
  const ts = new Date(lockedUntil).getTime();
  return Number.isFinite(ts) && ts > now;
}

export function lockUntilIso(now = Date.now()): string {
  return new Date(now + SHARE_LOCK_MS).toISOString();
}

export function lockRemainingMinutes(lockedUntil: string | null, now = Date.now()): number {
  if (!lockedUntil) return 0;
  const ts = new Date(lockedUntil).getTime();
  if (!Number.isFinite(ts) || ts <= now) return 0;
  return Math.max(1, Math.ceil((ts - now) / 60000));
}

/** Relative next= only: /dl /s /share. Blocks open redirects. */
export function safeShareNext(raw: string | null | undefined, fallback: string): string {
  const value = String(raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return fallback;
  if (value.startsWith("/dl/") || value.startsWith("/s/") || value.startsWith("/share/")) return value;
  return fallback;
}
