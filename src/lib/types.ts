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
};

export type StatsPayload = {
  fileCount: number;
  totalSize: number;
  downloadTotal: number;
  expiredCount: number;
  soonCount: number;
  soon: FileView[];
};

export function fileKey(path: string, name: string): string {
  return path ? `${path}/${name}` : name;
}

export function isExpired(expires: string | null, now = Date.now()): boolean {
  if (!expires) return false;
  const t = new Date(expires).getTime();
  return Number.isFinite(t) && t < now;
}
