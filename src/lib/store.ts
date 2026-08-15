import { getDB, getR2 } from "./cloudflare";
import { escapeLike } from "./like";
import { fileKey, isExpired, type FileRow, type FileView, type FolderNode, type FolderRow, type StatsPayload } from "./types";
import { sanitizeFolderName, sanitizeKey, splitKey } from "./sanitize";

function toView(row: FileRow, origin: string, now = Date.now()): FileView {
  const key = fileKey(row.path, row.name);
  return {
    ...row,
    key,
    url: `${origin}/dl/${key.split("/").map(encodeURIComponent).join("/")}`,
    expired: isExpired(row.expires, now),
  };
}

export async function listFiles(opts: {
  origin: string;
  path?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  filter?: "all" | "ok" | "soon" | "expired";
}): Promise<{ files: FileView[]; total: number }> {
  const db = await getDB();
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize || 50));
  const offset = (page - 1) * pageSize;
  const now = Date.now();
  const soon = new Date(now + 24 * 3600e3).toISOString();
  const nowIso = new Date(now).toISOString();

  const where: string[] = [];
  const binds: unknown[] = [];

  if (opts.q && opts.q.trim()) {
    where.push("name LIKE ? ESCAPE '\\'");
    binds.push(`%${escapeLike(opts.q.trim())}%`);
  } else if (opts.path != null) {
    where.push("path = ?");
    binds.push(opts.path);
  }

  if (opts.filter === "expired") {
    where.push("expires IS NOT NULL AND expires < ?");
    binds.push(nowIso);
  } else if (opts.filter === "soon") {
    where.push("expires IS NOT NULL AND expires >= ? AND expires < ?");
    binds.push(nowIso, soon);
  } else if (opts.filter === "ok") {
    where.push("(expires IS NULL OR expires >= ?)");
    binds.push(nowIso);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await db
    .prepare(`SELECT COUNT(*) as n FROM files ${clause}`)
    .bind(...binds)
    .first<{ n: number }>();
  const rows = await db
    .prepare(`SELECT * FROM files ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, pageSize, offset)
    .all<FileRow>();

  return {
    files: (rows.results || []).map((r) => toView(r, opts.origin, now)),
    total: count?.n || 0,
  };
}

export async function getFileByKey(key: string): Promise<FileRow | null> {
  const { path, name } = splitKey(key);
  const db = await getDB();
  return (
    (await db
      .prepare("SELECT * FROM files WHERE path = ? AND name = ?")
      .bind(path, name)
      .first<FileRow>()) || null
  );
}

export async function upsertFile(row: Omit<FileRow, "download_count"> & { download_count?: number }) {
  const db = await getDB();
  await db
    .prepare(
      `INSERT INTO files (id, name, path, size, mime, expires, download_count, created_at, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path, name) DO UPDATE SET
         id = excluded.id,
         size = excluded.size,
         mime = excluded.mime,
         expires = excluded.expires,
         created_at = excluded.created_at,
         tags = excluded.tags`,
    )
    .bind(
      row.id,
      row.name,
      row.path,
      row.size,
      row.mime,
      row.expires,
      row.download_count ?? 0,
      row.created_at,
      row.tags || "",
    )
    .run();
}

export async function setFileExpires(ids: string[], expires: string | null) {
  const db = await getDB();
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  await db
    .prepare(`UPDATE files SET expires = ? WHERE id IN (${placeholders})`)
    .bind(expires, ...ids)
    .run();
}

export async function incrementDownload(id: string) {
  const db = await getDB();
  await db.prepare("UPDATE files SET download_count = download_count + 1 WHERE id = ?").bind(id).run();
}

export async function deleteFiles(ids: string[]) {
  if (!ids.length) return { deleted: 0 };
  const db = await getDB();
  const r2 = await getR2();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db
    .prepare(`SELECT * FROM files WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<FileRow>();
  const files = rows.results || [];
  for (const f of files) {
    await r2.delete(fileKey(f.path, f.name));
  }
  await db.prepare(`DELETE FROM files WHERE id IN (${placeholders})`).bind(...ids).run();
  return { deleted: files.length };
}

export async function listFolders(): Promise<FolderNode[]> {
  const db = await getDB();
  const rows = await db
    .prepare("SELECT * FROM folders ORDER BY name COLLATE NOCASE ASC")
    .all<FolderRow>();
  return buildTree(rows.results || []);
}

function buildTree(rows: FolderRow[]): FolderNode[] {
  const byParent = new Map<string, FolderRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parent_id) || [];
    list.push(row);
    byParent.set(row.parent_id, list);
  }
  const walk = (parentId: string, prefix: string): FolderNode[] => {
    return (byParent.get(parentId) || []).map((row) => {
      const path = prefix ? `${prefix}/${row.name}` : row.name;
      return { ...row, path, children: walk(row.id, path) };
    });
  };
  return walk("", "");
}

export async function folderPathById(id: string): Promise<string | null> {
  const db = await getDB();
  const parts: string[] = [];
  let current: string | null = id;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) return null;
    seen.add(current);
    const row = (await db
      .prepare("SELECT id, name, parent_id, created_at FROM folders WHERE id = ?")
      .bind(current)
      .first()) as FolderRow | null;
    if (!row) return null;
    parts.unshift(row.name);
    current = row.parent_id || null;
  }
  return parts.join("/");
}

export async function createFolder(name: string, parentId = "") {
  const clean = sanitizeFolderName(name);
  if (clean.error || !clean.value) throw new Error(clean.error || "invalid-name");
  const db = await getDB();
  if (parentId) {
    const parent = await db.prepare("SELECT id FROM folders WHERE id = ?").bind(parentId).first();
    if (!parent) throw new Error("parent-not-found");
  }
  const id = crypto.randomUUID();
  try {
    await db
      .prepare("INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(id, clean.value, parentId, new Date().toISOString())
      .run();
  } catch (err) {
    if (/UNIQUE/i.test(String((err as Error).message || err))) throw new Error("folder-exists");
    throw err;
  }
  return { id, name: clean.value, parent_id: parentId };
}

export async function renameFolder(id: string, name: string) {
  const clean = sanitizeFolderName(name);
  if (clean.error || !clean.value) throw new Error(clean.error || "invalid-name");
  const db = await getDB();
  const oldPath = await folderPathById(id);
  if (oldPath == null) throw new Error("not-found");
  try {
    await db.prepare("UPDATE folders SET name = ? WHERE id = ?").bind(clean.value, id).run();
  } catch (err) {
    if (/UNIQUE/i.test(String((err as Error).message || err))) throw new Error("folder-exists");
    throw err;
  }
  const newPath = await folderPathById(id);
  if (newPath == null) throw new Error("not-found");
  if (oldPath !== newPath) {
    await rewriteFilePaths(oldPath, newPath);
  }
  return { id, path: newPath };
}

async function rewriteFilePaths(oldPath: string, newPath: string) {
  const db = await getDB();
  const r2 = await getR2();
  const rows = await db
    .prepare("SELECT * FROM files WHERE path = ? OR path LIKE ?")
    .bind(oldPath, `${oldPath}/%`)
    .all<FileRow>();
  for (const file of rows.results || []) {
    const nextPath = file.path === oldPath ? newPath : newPath + file.path.slice(oldPath.length);
    const fromKey = fileKey(file.path, file.name);
    const toKey = fileKey(nextPath, file.name);
    if (fromKey !== toKey) {
      const obj = await r2.get(fromKey);
      if (obj) {
        await r2.put(toKey, await obj.arrayBuffer(), {
          httpMetadata: obj.httpMetadata,
          customMetadata: obj.customMetadata,
        });
        await r2.delete(fromKey);
      }
    }
    await db.prepare("UPDATE files SET path = ? WHERE id = ?").bind(nextPath, file.id).run();
  }
}

export async function deleteFolder(id: string) {
  const db = await getDB();
  const r2 = await getR2();
  const path = await folderPathById(id);
  if (path == null) throw new Error("not-found");
  const files = await db
    .prepare("SELECT * FROM files WHERE path = ? OR path LIKE ?")
    .bind(path, `${path}/%`)
    .all<FileRow>();
  for (const file of files.results || []) {
    await r2.delete(fileKey(file.path, file.name));
  }
  await db
    .prepare("DELETE FROM files WHERE path = ? OR path LIKE ?")
    .bind(path, `${path}/%`)
    .run();

  const folders = await db.prepare("SELECT * FROM folders").all<FolderRow>();
  const tree = buildTree(folders.results || []);
  const ids = collectIds(tree, id);
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    await db.prepare(`DELETE FROM folders WHERE id IN (${placeholders})`).bind(...ids).run();
  }
  return { deletedFiles: files.results?.length || 0, deletedFolders: ids.length };
}

function collectIds(nodes: FolderNode[], targetId: string): string[] {
  const walkFind = (list: FolderNode[]): FolderNode | null => {
    for (const n of list) {
      if (n.id === targetId) return n;
      const found = walkFind(n.children);
      if (found) return found;
    }
    return null;
  };
  const node = walkFind(nodes);
  if (!node) return [];
  const ids: string[] = [];
  const dump = (n: FolderNode) => {
    ids.push(n.id);
    n.children.forEach(dump);
  };
  dump(node);
  return ids;
}

export async function getStats(origin: string): Promise<StatsPayload> {
  const db = await getDB();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const soonIso = new Date(now + 24 * 3600e3).toISOString();
  const agg = await db
    .prepare(
      `SELECT
         COUNT(*) as fileCount,
         COALESCE(SUM(size), 0) as totalSize,
         COALESCE(SUM(download_count), 0) as downloadTotal,
         SUM(CASE WHEN expires IS NOT NULL AND expires < ? THEN 1 ELSE 0 END) as expiredCount,
         SUM(CASE WHEN expires IS NOT NULL AND expires >= ? AND expires < ? THEN 1 ELSE 0 END) as soonCount
       FROM files`,
    )
    .bind(nowIso, nowIso, soonIso)
    .first<{
      fileCount: number;
      totalSize: number;
      downloadTotal: number;
      expiredCount: number;
      soonCount: number;
    }>();
  const soonRows = await db
    .prepare(
      "SELECT * FROM files WHERE expires IS NOT NULL AND expires >= ? AND expires < ? ORDER BY expires ASC LIMIT 8",
    )
    .bind(nowIso, soonIso)
    .all<FileRow>();
  return {
    fileCount: agg?.fileCount || 0,
    totalSize: agg?.totalSize || 0,
    downloadTotal: agg?.downloadTotal || 0,
    expiredCount: agg?.expiredCount || 0,
    soonCount: agg?.soonCount || 0,
    soon: (soonRows.results || []).map((r) => toView(r, origin, now)),
  };
}

export function assertKey(raw: string) {
  const key = sanitizeKey(raw);
  if (key.error || !key.value) {
    throw new Error(key.error || "bad-key");
  }
  return key.value;
}
