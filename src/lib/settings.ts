import { getDB } from "./cloudflare";
import type { SiteSettings } from "./types";

export const DEFAULTS: SiteSettings = {
  site_name: "直链盘",
  site_description: "带有效期的文件直链",
  brand_color: "#171717",
  page_size: 50,
  default_expires: "24h",
  home_kicker: "直链下载",
  home_cta: "管理后台",
  home_dl_hint: "公开地址：/dl/文件路径",
  login_subtitle: "管理员登录",
  admin_subtitle: "管理",
  footer_note: "",
  show_admin_link: true,
  logo_text: "",
  purge_after_days: 7,
  oauth_allow_emails: "",
};

function clip(raw: string | undefined, fallback: string, max: number): string {
  const v = (raw ?? "").trim();
  if (!v) return fallback;
  return v.slice(0, max);
}

function optional(raw: string | undefined, max: number): string {
  return (raw ?? "").trim().slice(0, max);
}

function asBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true" || raw === "yes";
}

function clampDays(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(3650, Math.floor(n));
}

export function parseEmailList(raw: string | undefined): string[] {
  return (raw || "")
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
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
    site_name: clip(map.get("site_name"), DEFAULTS.site_name, 40),
    site_description: optional(map.get("site_description"), 200) || DEFAULTS.site_description,
    brand_color: /^#[0-9a-fA-F]{6}$/.test(map.get("brand_color") || "")
      ? (map.get("brand_color") as string)
      : DEFAULTS.brand_color,
    page_size: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(200, Math.floor(pageSize)) : 50,
    default_expires: map.get("default_expires") || DEFAULTS.default_expires,
    home_kicker: optional(map.get("home_kicker"), 40),
    home_cta: clip(map.get("home_cta"), DEFAULTS.home_cta, 24),
    home_dl_hint: optional(map.get("home_dl_hint"), 80),
    login_subtitle: optional(map.get("login_subtitle"), 40),
    admin_subtitle: optional(map.get("admin_subtitle"), 20),
    footer_note: optional(map.get("footer_note"), 200),
    show_admin_link: asBool(map.get("show_admin_link"), DEFAULTS.show_admin_link),
    logo_text: optional(map.get("logo_text"), 2),
    purge_after_days: clampDays(map.get("purge_after_days"), DEFAULTS.purge_after_days),
    oauth_allow_emails: optional(map.get("oauth_allow_emails"), 2000),
  };
}

export async function updateSettings(
  patch: Partial<SiteSettings>,
  db?: D1Database,
): Promise<SiteSettings> {
  const conn = db ?? (await getDB());
  const current = await getSettings(conn);
  const next: SiteSettings = { ...current, ...patch };

  next.site_name = clip(next.site_name, DEFAULTS.site_name, 40);
  next.site_description = optional(next.site_description, 200);
  next.home_kicker = optional(next.home_kicker, 40);
  next.home_cta = clip(next.home_cta, DEFAULTS.home_cta, 24);
  next.home_dl_hint = optional(next.home_dl_hint, 80);
  next.login_subtitle = optional(next.login_subtitle, 40);
  next.admin_subtitle = optional(next.admin_subtitle, 20);
  next.footer_note = optional(next.footer_note, 200);
  next.logo_text = optional(next.logo_text, 2);
  next.oauth_allow_emails = optional(next.oauth_allow_emails, 2000);

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

  const entries: [string, string][] = [
    ["site_name", next.site_name],
    ["site_description", next.site_description],
    ["brand_color", next.brand_color],
    ["page_size", String(next.page_size)],
    ["default_expires", next.default_expires],
    ["home_kicker", next.home_kicker],
    ["home_cta", next.home_cta],
    ["home_dl_hint", next.home_dl_hint],
    ["login_subtitle", next.login_subtitle],
    ["admin_subtitle", next.admin_subtitle],
    ["footer_note", next.footer_note],
    ["show_admin_link", next.show_admin_link ? "1" : "0"],
    ["logo_text", next.logo_text],
    ["purge_after_days", String(next.purge_after_days)],
    ["oauth_allow_emails", next.oauth_allow_emails],
  ];
  for (const [key, value] of entries) {
    await conn
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(key, value)
      .run();
  }
  return next;
}
