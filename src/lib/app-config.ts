export const KV = {
  accessEnabled: "access_enabled",
  cronSecret: "cron_secret",
  cfAccountId: "cf_account_id",
  cfApiToken: "cf_api_token",
  cfWorkerName: "cf_worker_name",
  cfR2Bucket: "cf_r2_bucket",
  cfD1DatabaseId: "cf_d1_database_id",
  cfAccessTeam: "cf_access_team",
  cfAccessAud: "cf_access_aud",
} as const;

export function parseFlag(raw: string | undefined | null): boolean {
  const value = (raw || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
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

export function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureCronSecret(db: D1Database): Promise<string> {
  const existing = await getKv(db, KV.cronSecret);
  if (existing) return existing;
  const next = randomSecret();
  await setKv(db, KV.cronSecret, next);
  return next;
}
