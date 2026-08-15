import { ensureCronSecret, getKv, KV, parseAuthMode, setKv } from "./app-config";
import { getDB } from "./cloudflare";
import type { SiteSettings } from "./types";

export const DEFAULTS: SiteSettings = {
  brand_color: "#171717",
  page_size: 50,
  default_expires: "24h",
  purge_after_days: 7,
  auth_mode: "password",
  cf_account_id: "",
  cf_api_token_set: false,
  cf_worker_name: "",
  cf_r2_bucket: "",
  cf_d1_database_id: "",
  cron_secret: "",
};

export type SettingsPatch = Partial<SiteSettings> & {
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
    brand_color: /^#[0-9a-fA-F]{6}$/.test(map.get("brand_color") || "")
      ? (map.get("brand_color") as string)
      : DEFAULTS.brand_color,
    page_size: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(200, Math.floor(pageSize)) : 50,
    default_expires: map.get("default_expires") || DEFAULTS.default_expires,
    purge_after_days: clampDays(map.get("purge_after_days"), DEFAULTS.purge_after_days),
    auth_mode: parseAuthMode(map.get(KV.authMode)),
    cf_account_id: unset(map.get(KV.cfAccountId)),
    cf_api_token_set: Boolean(unset(map.get(KV.cfApiToken))),
    cf_worker_name: unset(map.get(KV.cfWorkerName)),
    cf_r2_bucket: unset(map.get(KV.cfR2Bucket)),
    cf_d1_database_id: unset(map.get(KV.cfD1DatabaseId)),
    cron_secret: (await getKv(conn, KV.cronSecret)) || "",
  };
}

export async function updateSettings(patch: SettingsPatch, db?: D1Database): Promise<SiteSettings> {
  const conn = db ?? (await getDB());
  const current = await getSettings(conn);
  const next: SiteSettings = { ...current, ...patch, cf_api_token_set: current.cf_api_token_set };

  if (patch.page_size != null) {
    const n = Number(patch.page_size);
    next.page_size = Number.isFinite(n) && n > 0 ? Math.min(200, Math.floor(n)) : current.page_size;
  }
  if (patch.brand_color && !/^#[0-9a-fA-F]{6}$/.test(patch.brand_color)) {
    next.brand_color = current.brand_color;
  }
  if (patch.purge_after_days != null) {
    next.purge_after_days = clampDays(String(patch.purge_after_days), current.purge_after_days);
  }
  if (patch.auth_mode) {
    next.auth_mode = parseAuthMode(patch.auth_mode);
  }

  const entries: [string, string][] = [
    ["brand_color", next.brand_color],
    ["page_size", String(next.page_size)],
    ["default_expires", next.default_expires],
    ["purge_after_days", String(next.purge_after_days)],
    [KV.authMode, next.auth_mode],
    [KV.cfAccountId, unset(next.cf_account_id)],
    [KV.cfWorkerName, unset(next.cf_worker_name)],
    [KV.cfR2Bucket, unset(next.cf_r2_bucket)],
    [KV.cfD1DatabaseId, unset(next.cf_d1_database_id)],
  ];
  for (const [key, value] of entries) {
    await setKv(conn, key, value);
  }

  if (typeof patch.cf_api_token === "string") {
    const token = patch.cf_api_token.trim();
    if (!token) {
      await conn.prepare("DELETE FROM settings WHERE key = ?").bind(KV.cfApiToken).run();
      next.cf_api_token_set = false;
    } else {
      await setKv(conn, KV.cfApiToken, token);
      next.cf_api_token_set = true;
    }
  }

  if (patch.rotate_cron_secret) {
    await conn.prepare("DELETE FROM settings WHERE key = ?").bind(KV.cronSecret).run();
    next.cron_secret = await ensureCronSecret(conn);
  } else {
    next.cron_secret = (await getKv(conn, KV.cronSecret)) || current.cron_secret;
  }

  return next;
}
