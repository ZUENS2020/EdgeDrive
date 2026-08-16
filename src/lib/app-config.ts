import type { AuthMode } from "./types";

export const KV = {
  authMode: "auth_mode",
  authSecret: "auth_secret",
  cronSecret: "cron_secret",
  cfAccountId: "cf_account_id",
  cfApiToken: "cf_api_token",
  cfWorkerName: "cf_worker_name",
  cfR2Bucket: "cf_r2_bucket",
  cfD1DatabaseId: "cf_d1_database_id",
  cfAccessTeam: "cf_access_team",
  cfAccessAud: "cf_access_aud",
} as const;

export function parseAuthMode(raw: string | undefined | null): AuthMode {
  const value = (raw || "password").trim().toLowerCase();
  if (value === "none" || value === "access" || value === "oauth") return "access";
  return "password";
}

export function originFromHeaders(hdrs: Headers): string | undefined {
  const host = (hdrs.get("x-forwarded-host") || hdrs.get("host") || "").split(",")[0].trim();
  if (!host) return undefined;
  const forwarded = (hdrs.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto =
    forwarded || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function getKv(db: D1Database, key: string): Promise<string | undefined> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{
    value: string;
  }>();
  const value = row?.value?.trim();
  if (!value || value.toUpperCase() === "NULL") return undefined;
  return value;
}

export async function setKv(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key, value)
    .run();
}

export async function deleteKv(db: D1Database, key: string): Promise<void> {
  await db.prepare("DELETE FROM settings WHERE key = ?").bind(key).run();
}

export function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureAuthSecret(db: D1Database): Promise<string> {
  const existing = await getKv(db, KV.authSecret);
  if (existing && existing.length >= 32) return existing;
  const next = randomSecret();
  await setKv(db, KV.authSecret, next);
  return next;
}

export async function ensureCronSecret(db: D1Database): Promise<string> {
  const existing = await getKv(db, KV.cronSecret);
  if (existing) return existing;
  const next = randomSecret();
  await setKv(db, KV.cronSecret, next);
  return next;
}

export async function hasAdmin(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS ok FROM admin LIMIT 1").first<{ ok: number }>();
  return Boolean(row);
}

export async function readAuthModeFromDb(db: D1Database): Promise<AuthMode> {
  return parseAuthMode(await getKv(db, KV.authMode));
}
