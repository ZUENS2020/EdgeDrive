import { escapeLike } from "./like";

export const FILE_LIST_FILTERS = ["all", "ok", "soon", "expired", "trash", "starred", "recent"] as const;
export type FileListFilter = (typeof FILE_LIST_FILTERS)[number];

export const GLOBAL_FILE_FILTERS: readonly FileListFilter[] = ["trash", "starred", "recent"];

export const TRASH_RETENTION_DAYS = 30;

export function parseFileListFilter(raw: string | null | undefined): FileListFilter {
  const s = (raw || "all").trim();
  return (FILE_LIST_FILTERS as readonly string[]).includes(s) ? (s as FileListFilter) : "all";
}

export function isGlobalFileFilter(filter: FileListFilter): boolean {
  return (GLOBAL_FILE_FILTERS as readonly string[]).includes(filter);
}

export function isoDaysAgo(days: number, now = Date.now()): string {
  return new Date(now - Math.max(0, days) * 86400e3).toISOString();
}

export function trashCutoffIso(now = Date.now()): string {
  return isoDaysAgo(TRASH_RETENTION_DAYS, now);
}

export function buildFileListWhere(opts: {
  q?: string;
  path?: string;
  filter?: FileListFilter;
  tag?: string;
  nowIso: string;
  soonIso: string;
}): { clause: string; binds: unknown[] } {
  const where: string[] = [];
  const binds: unknown[] = [];
  const filter = opts.filter || "all";

  if (filter === "trash") where.push("deleted_at IS NOT NULL");
  else where.push("deleted_at IS NULL");

  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim().slice(0, 40);
    where.push("name LIKE ? ESCAPE '\\'");
    binds.push(`%${escapeLike(q)}%`);
  } else if (opts.path != null && !isGlobalFileFilter(filter)) {
    where.push("path = ?");
    binds.push(opts.path);
  }

  if (filter === "expired") {
    where.push("expires IS NOT NULL AND expires < ?");
    binds.push(opts.nowIso);
  } else if (filter === "soon") {
    where.push("expires IS NOT NULL AND expires >= ? AND expires < ?");
    binds.push(opts.nowIso, opts.soonIso);
  } else if (filter === "ok") {
    where.push("(expires IS NULL OR expires >= ?)");
    binds.push(opts.nowIso);
  } else if (filter === "starred") {
    where.push("starred != 0");
  }

  const tag = (opts.tag || "").trim().slice(0, 40);
  if (tag) {
    where.push("(',' || tags || ',') LIKE ? ESCAPE '\\'");
    binds.push(`%,${escapeLike(tag)},%`);
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    binds,
  };
}
