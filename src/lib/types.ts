export type AuthMode = "access" | "password";

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
  viewUrl: string;
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
  brand_color: string;
  page_size: number;
  default_expires: string;
  purge_after_days: number;
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

export function encodeDlPath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function dlUrl(origin: string, key: string, view = false): string {
  return `${origin.replace(/\/$/, "")}/dl/${encodeDlPath(key)}${view ? "/view" : ""}`;
}

export function flattenFolderPaths(nodes: FolderNode[]): { path: string; label: string }[] {
  const out: { path: string; label: string }[] = [];
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      out.push({ path: n.path, label: n.path });
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function isExpired(expires: string | null, now = Date.now()): boolean {
  if (!expires) return false;
  const t = new Date(expires).getTime();
  return Number.isFinite(t) && t < now;
}
