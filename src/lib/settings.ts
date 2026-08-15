import { getDB } from "./cloudflare";
import type { SiteSettings } from "./types";

const DEFAULTS: SiteSettings = {
  site_name: "ZUENS DL",
  site_description: "下载资源管理平台",
  brand_color: "#171717",
  page_size: 50,
  default_expires: "24h",
};

export async function getSettings(db?: D1Database): Promise<SiteSettings> {
  const conn = db ?? (await getDB());
  const rows = await conn.prepare("SELECT key, value FROM settings").all<{
    key: string;
    value: string;
  }>();
  const map = new Map((rows.results || []).map((r) => [r.key, r.value]));
  const pageSize = Number(map.get("page_size") || DEFAULTS.page_size);
  return {
    site_name: map.get("site_name") || DEFAULTS.site_name,
    site_description: map.get("site_description") || DEFAULTS.site_description,
    brand_color: map.get("brand_color") || DEFAULTS.brand_color,
    page_size: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(200, Math.floor(pageSize)) : 50,
    default_expires: map.get("default_expires") || DEFAULTS.default_expires,
  };
}

export async function updateSettings(
  patch: Partial<SiteSettings>,
  db?: D1Database,
): Promise<SiteSettings> {
  const conn = db ?? (await getDB());
  const current = await getSettings(conn);
  const next: SiteSettings = {
    ...current,
    ...patch,
  };
  if (patch.page_size != null) {
    const n = Number(patch.page_size);
    next.page_size = Number.isFinite(n) && n > 0 ? Math.min(200, Math.floor(n)) : current.page_size;
  }
  if (patch.brand_color && !/^#[0-9a-fA-F]{6}$/.test(patch.brand_color)) {
    next.brand_color = current.brand_color;
  }
  const entries: [string, string][] = [
    ["site_name", next.site_name],
    ["site_description", next.site_description],
    ["brand_color", next.brand_color],
    ["page_size", String(next.page_size)],
    ["default_expires", next.default_expires],
  ];
  for (const [key, value] of entries) {
    await conn
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(key, value)
      .run();
  }
  return next;
}
