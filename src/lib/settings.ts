import { ensureCronSecret, getKv, KV, parseFlag, setKv } from "./app-config";
import { cfApiTokenConfigured, readEnvSecret } from "./cf-credentials";
import { getDB } from "./cloudflare";
import { getTheme } from "./themes";
import type { SiteSettings } from "./types";

export const DEFAULTS: SiteSettings = {
  theme_name: "default",
  page_size: 50,
  default_expires: "24h",
  purge_after_days: 7,
  access_enabled: false,
  cf_account_id: "",
  cf_api_token_set: false,
  cf_worker_name: "",
  cf_r2_bucket: "",
  cf_d1_database_id: "",
  cf_access_team: "",
  cf_access_aud: "",
  cron_secret: "",
};

export type SettingsPatch = Partial<Omit<SiteSettings, "access_enabled">> & {
  cf_api_token?: string;
  rotate_cron_secret?: boolean;
};

function clampDays(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(3650, Math.floor(n));
}

function unset(value: string | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") return "";
  return trimmed;
}

export async function getSettings(db?: D1Database): Promise<SiteSettings> {
  const conn = db ?? (await getDB());
  const rows = await conn.prepare("SELECT key, value FROM settings").all<{
    key: string;
    value: string;
  }>();
  const map = new Map((rows.results || []).map((r) => [r.key, r.value]));
  const pageSize = Number(map.get("page_size") || DEFAULTS.page_size);
  return {
    theme_name: getTheme(map.get("theme_name")).id,
    page_size: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(200, Math.floor(pageSize)) : 50,
    default_expires: map.get("default_expires") || DEFAULTS.default_expires,
    purge_after_days: clampDays(map.get("purge_after_days"), DEFAULTS.purge_after_days),
    access_enabled: parseFlag(map.get(KV.accessEnabled)),
    cf_account_id: unset(map.get(KV.cfAccountId)),
    cf_api_token_from_env: Boolean(readEnvSecret("CF_API_TOKEN")),
    cf_api_token_set: cfApiTokenConfigured(unset(map.get(KV.cfApiToken))),
    cron_secret_set: Boolean(unset(map.get(KV.cronSecret))),
    cf_worker_name: unset(map.get(KV.cfWorkerName)),
    cf_r2_bucket: unset(map.get(KV.cfR2Bucket)),
    cf_d1_database_id: unset(map.get(KV.cfD1DatabaseId)),
    cf_access_team: unset(map.get(KV.cfAccessTeam)),
    cf_access_aud: unset(map.get(KV.cfAccessAud)),
    cron_secret: "",
  };
}

export async function updateSettings(patch: SettingsPatch, db?: D1Database): Promise<SiteSettings> {
  const conn = db ?? (await getDB());
  const current = await getSettings(conn);
  const next: SiteSettings = {
    ...current,
    ...patch,
    access_enabled: current.access_enabled,
    cf_api_token_set: current.cf_api_token_set,
    cf_api_token_from_env: current.cf_api_token_from_env,
  };

  if (patch.page_size != null) {
    const n = Number(patch.page_size);
    next.page_size = Number.isFinite(n) && n > 0 ? Math.min(200, Math.floor(n)) : current.page_size;
  }
  if (patch.theme_name != null) {
    next.theme_name = getTheme(patch.theme_name).id;
  }
  if (patch.purge_after_days != null) {
    next.purge_after_days = clampDays(String(patch.purge_after_days), current.purge_after_days);
  }
  next.cf_access_team = unset(next.cf_access_team);
  next.cf_access_aud = unset(next.cf_access_aud);

  const entries: [string, string][] = [
    ["theme_name", next.theme_name],
    ["page_size", String(next.page_size)],
    ["default_expires", next.default_expires],
    ["purge_after_days", String(next.purge_after_days)],
    [KV.cfAccountId, unset(next.cf_account_id)],
    [KV.cfWorkerName, unset(next.cf_worker_name)],
    [KV.cfR2Bucket, unset(next.cf_r2_bucket)],
    [KV.cfD1DatabaseId, unset(next.cf_d1_database_id)],
    [KV.cfAccessTeam, next.cf_access_team],
    [KV.cfAccessAud, next.cf_access_aud],
  ];
  for (const [key, value] of entries) {
    await setKv(conn, key, value);
  }

  if (typeof patch.cf_api_token === "string") {
    const token = patch.cf_api_token.trim();
    if (!token) {
      await conn.prepare("DELETE FROM settings WHERE key = ?").bind(KV.cfApiToken).run();
    } else {
      await setKv(conn, KV.cfApiToken, token);
    }
  }
  next.cf_api_token_from_env = Boolean(readEnvSecret("CF_API_TOKEN"));
  next.cf_api_token_set = cfApiTokenConfigured(await getKv(conn, KV.cfApiToken));

  if (patch.rotate_cron_secret) {
    await conn.prepare("DELETE FROM settings WHERE key = ?").bind(KV.cronSecret).run();
    await ensureCronSecret(conn);
  }
  next.cron_secret = "";
  next.cron_secret_set = Boolean(await getKv(conn, KV.cronSecret).catch(() => undefined));

  return next;
}

/** First-boot: write team/aud and flip access_enabled. Cannot run after Access is already on. */
export async function enableAccess(
  team: string,
  aud: string,
  db?: D1Database,
): Promise<SiteSettings> {
  const conn = db ?? (await getDB());
  const current = await getSettings(conn);
  if (current.access_enabled) {
    throw new Error("access-already-enabled");
  }
  const nextTeam = unset(team);
  const nextAud = unset(aud);
  if (!nextTeam || !nextAud) {
    throw new Error("access-needs-team-aud: 请填写 Cloudflare Access Team 和 AUD");
  }
  await setKv(conn, KV.cfAccessTeam, nextTeam);
  await setKv(conn, KV.cfAccessAud, nextAud);
  await setKv(conn, KV.accessEnabled, "1");
  return getSettings(conn);
}
