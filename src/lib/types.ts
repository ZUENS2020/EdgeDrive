export type AuthMode = "better-auth" | "none";

export type FileRow = {
  id: string;
  name: string;
  path: string;
  size: number;
  mime: string | null;
  expires: string | null;
  download_count: number;
  created_at: string;
  tags: string;
};

export type FileView = FileRow & {
  key: string;
  url: string;
  expired: boolean;
};

export type FolderRow = {
  id: string;
  name: string;
  parent_id: string;
  created_at: string;
};

export type FolderNode = FolderRow & {
  path: string;
  children: FolderNode[];
};

export type SiteSettings = {
  site_name: string;
  site_description: string;
  brand_color: string;
  page_size: number;
  default_expires: string;
  home_kicker: string;
  home_cta: string;
  home_dl_hint: string;
  login_subtitle: string;
  admin_subtitle: string;
  footer_note: string;
  show_admin_link: boolean;
  logo_text: string;
};

export type StatsPayload = {
  fileCount: number;
  totalSize: number;
  downloadTotal: number;
  expiredCount: number;
  soonCount: number;
  soon: FileView[];
};

export function logoGlyph(settings: Pick<SiteSettings, "site_name" | "logo_text">): string {
  const custom = settings.logo_text.trim();
  if (custom) return [...custom].slice(0, 2).join("");
  const first = [...settings.site_name].find((ch) => ch.trim());
  return (first || "D").toUpperCase();
}

export function fileKey(path: string, name: string): string {
  return path ? `${path}/${name}` : name;
}

export function isExpired(expires: string | null, now = Date.now()): boolean {
  if (!expires) return false;
  const t = new Date(expires).getTime();
  return Number.isFinite(t) && t < now;
}
