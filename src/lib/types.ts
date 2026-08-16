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
  /** Builtin theme id: default | light | suzuka */
  theme_name: string;
  page_size: number;
  default_expires: string;
  purge_after_days: number;
  /** Cloudflare Access 已启用——此后管理请求一律验 JWT。 */
  access_enabled: boolean;
  cf_account_id: string;
  cf_api_token_set: boolean;
  /** Token 来自 Worker Secret CF_API_TOKEN，而不是 D1。 */
  cf_api_token_from_env?: boolean;
  cf_worker_name: string;
  cf_r2_bucket: string;
  cf_d1_database_id: string;
  /** Cloudflare Access 团队名（Zero Trust 首页，如 zuens2020）。存 D1，部署不丢。 */
  cf_access_team: string;
  /** Access Application AUD Tag。存 D1，部署不丢。 */
  cf_access_aud: string;
  cron_secret: string;
  /** GET 响应中 cron_secret 已遮罩——此字段指示是否已设置。 */
  cron_secret_set?: boolean;
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

/** Max files in one batch share link. */
export const MAX_BATCH_IDS = 100;

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
