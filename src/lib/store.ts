import { getDB, getR2 } from "./cloudflare";
import { decideCopyItem, type CopyItemResult } from "./copy";
import { copyObject } from "./r2-copy";
import {
  buildFileListWhere,
  parseFileListFilter,
  trashCutoffIso,
  type FileListFilter,
} from "./files-query";
import { escapeLike } from "./like";
import { sanitizeFileName, sanitizeFolderName, sanitizeKey, splitKey } from "./sanitize";
import { normalizeSha256 } from "./sha256";
import { collectUniqueTags, serializeTags } from "./tags";
import { adminFileContentPath, adminFileViewPath } from "./share-urls";
import {
  dlUrl,
  fileKey,
  flattenFolderPaths,
  isExpired,
  type FileRow,
  type FileView,
  type FolderNode,
  type FolderRow,
  type StatsPayload,
} from "./types";

/** D1 单查询绑定参数上限 100——分批用。 */
function chunkIds(ids: string[], size = 90): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export function normalizeFileRow(row: FileRow): FileRow {
  return {
    ...row,
    tags: row.tags || "",
    deleted_at: row.deleted_at ?? null,
    starred: Number(row.starred) ? 1 : 0,
    sha256: row.sha256 ?? null,
  };
}

function toView(row: FileRow, origin: string, now = Date.now()): FileView {
  const key = fileKey(row.path, row.name);
  const n = normalizeFileRow(row);
  return {
    ...n,
    key,
    url: dlUrl(origin, key),
    viewUrl: dlUrl(origin, key, true),
    contentUrl: adminFileContentPath(row.id),
    adminViewUrl: adminFileViewPath(row.id),
    expired: isExpired(n.expires, now),
  };
}

export async function listFileTags(): Promise<string[]> {
  const db = await getDB();
  const rows = await db
    .prepare("SELECT tags FROM files WHERE deleted_at IS NULL AND tags != ''")
    .all<{ tags: string }>();
  return collectUniqueTags(rows.results || []);
}

export async function listFiles(opts: {
  origin: string;
  path?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  filter?: FileListFilter;
  tag?: string;
}): Promise<{ files: FileView[]; total: number; allTags: string[] }> {
  const db = await getDB();
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize || 50));
  const offset = (page - 1) * pageSize;
  const now = Date.now();
  const soon = new Date(now + 24 * 3600e3).toISOString();
  const nowIso = new Date(now).toISOString();
  const filter = parseFileListFilter(opts.filter);
  const { clause, binds } = buildFileListWhere({
    q: opts.q,
    path: opts.path,
    filter,
    tag: opts.tag,
    nowIso,
    soonIso: soon,
  });
  const count = await db
    .prepare(`SELECT COUNT(*) as n FROM files ${clause}`)
    .bind(...binds)
    .first<{ n: number }>();
  const rows = await db
    .prepare(`SELECT * FROM files ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, pageSize, offset)
    .all<FileRow>();
  const allTags = await listFileTags();

  return {
    files: (rows.results || []).map((r) => toView(r, opts.origin, now)),
    total: count?.n || 0,
    allTags,
  };
}

export async function getFileById(id: string): Promise<FileRow | null> {
  const db = await getDB();
  const row = (await db.prepare("SELECT * FROM files WHERE id = ?").bind(id).first<FileRow>()) || null;
  return row ? normalizeFileRow(row) : null;
}

export async function getFileByKey(key: string): Promise<FileRow | null> {
  const { path, name } = splitKey(key);
  const db = await getDB();
  const row =
    (await db
      .prepare("SELECT * FROM files WHERE path = ? AND name = ? AND deleted_at IS NULL")
      .bind(path, name)
      .first<FileRow>()) || null;
  return row ? normalizeFileRow(row) : null;
}

type FileWrite = Omit<FileRow, "download_count" | "deleted_at" | "starred" | "sha256"> & {
  download_count?: number;
  deleted_at?: string | null;
  starred?: number;
  sha256?: string | null;
};

async function insertFileRecord(row: FileWrite) {
  const db = await getDB();
  const tags = serializeTags(row.tags);
  const sha256 = normalizeSha256(row.sha256) || row.sha256 || null;
  const starred = Number(row.starred) ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO files (id, name, path, size, mime, expires, download_count, created_at, tags, deleted_at, starred, sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      tags,
      row.deleted_at ?? null,
      starred,
      sha256,
    )
    .run();
}

export async function upsertFile(row: FileWrite) {
  const db = await getDB();
  const tags = serializeTags(row.tags);
  const sha256 = normalizeSha256(row.sha256) || row.sha256 || null;
  const existing = await db
    .prepare("SELECT id, download_count, starred FROM files WHERE path = ? AND name = ? AND deleted_at IS NULL")
    .bind(row.path, row.name)
    .first<{ id: string; download_count: number; starred: number }>();
  if (existing) {
    await db
      .prepare(
        `UPDATE files SET size = ?, mime = ?, expires = ?, created_at = ?, tags = ?, sha256 = ?
         WHERE id = ?`,
      )
      .bind(row.size, row.mime, row.expires, row.created_at, tags, sha256, existing.id)
      .run();
    return;
  }
  await insertFileRecord(row);
}

export async function setFileTags(ids: string[], tags: string) {
  const db = await getDB();
  if (!ids.length) return;
  const value = serializeTags(tags);
  for (const chunk of chunkIds(ids)) {
    const placeholders = chunk.map(() => "?").join(",");
    await db
      .prepare(`UPDATE files SET tags = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
      .bind(value, ...chunk)
      .run();
  }
}

export async function setFileStarred(ids: string[], starred: boolean | number) {
  const db = await getDB();
  if (!ids.length) return;
  const value = starred ? 1 : 0;
  for (const chunk of chunkIds(ids)) {
    const placeholders = chunk.map(() => "?").join(",");
    await db
      .prepare(`UPDATE files SET starred = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
      .bind(value, ...chunk)
      .run();
  }
}

export async function softDeleteFiles(ids: string[]): Promise<{ deleted: number }> {
  if (!ids.length) return { deleted: 0 };
  const db = await getDB();
  const now = new Date().toISOString();
  let deleted = 0;
  for (const chunk of chunkIds(ids)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT id FROM files WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
      .bind(...chunk)
      .all<{ id: string }>();
    const live = (rows.results || []).map((r) => r.id);
    if (!live.length) continue;
    const marks = live.map(() => "?").join(",");
    await db
      .prepare(`UPDATE files SET deleted_at = ? WHERE id IN (${marks})`)
      .bind(now, ...live)
      .run();
    deleted += live.length;
  }
  return { deleted };
}

export async function restoreFiles(ids: string[]): Promise<{ restored: number }> {
  if (!ids.length) return { restored: 0 };
  const db = await getDB();
  const files: FileRow[] = [];
  for (const chunk of chunkIds(ids)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`)
      .bind(...chunk)
      .all<FileRow>();
    files.push(...(rows.results || []));
  }
  for (const file of files) {
    const clash = await db
      .prepare("SELECT id FROM files WHERE path = ? AND name = ? AND deleted_at IS NULL AND id != ?")
      .bind(file.path, file.name, file.id)
      .first<{ id: string }>();
    if (clash) throw new Error("file-exists");
  }
  let restored = 0;
  for (const file of files) {
    await db.prepare("UPDATE files SET deleted_at = NULL WHERE id = ?").bind(file.id).run();
    restored += 1;
  }
  return { restored };
}

export async function setFileExpires(ids: string[], expires: string | null) {
  const db = await getDB();
  if (!ids.length) return;
  // D1 单查询绑定参数上限 100——分批执行
  for (const chunk of chunkIds(ids)) {
    const placeholders = chunk.map(() => "?").join(",");
    await db
      .prepare(`UPDATE files SET expires = ? WHERE id IN (${placeholders})`)
      .bind(expires, ...chunk)
      .run();
  }
}

export async function incrementDownload(id: string) {
  const db = await getDB();
  await db.prepare("UPDATE files SET download_count = download_count + 1 WHERE id = ?").bind(id).run();
}

export async function deleteFiles(ids: string[]) {
  if (!ids.length) return { deleted: 0 };
  const db = await getDB();
  const r2 = await getR2();
  let deleted = 0;
  for (const chunk of chunkIds(ids)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT * FROM files WHERE id IN (${placeholders})`)
      .bind(...chunk)
      .all<FileRow>();
    const files = rows.results || [];
    for (const f of files) {
      await r2.delete(fileKey(f.path, f.name));
    }
    await db.prepare(`DELETE FROM files WHERE id IN (${placeholders})`).bind(...chunk).run();
    deleted += files.length;
  }
  return { deleted };
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
    .prepare("SELECT * FROM files WHERE path = ? OR path LIKE ? ESCAPE '\\'")
    .bind(oldPath, `${escapeLike(oldPath)}/%`)
    .all<FileRow>();
  for (const file of rows.results || []) {
    const nextPath = file.path === oldPath ? newPath : newPath + file.path.slice(oldPath.length);
    const fromKey = fileKey(file.path, file.name);
    const toKey = fileKey(nextPath, file.name);
    if (fromKey !== toKey) {
      const copied = await copyObject(fromKey, toKey);
      await db.prepare("UPDATE files SET path = ? WHERE id = ?").bind(nextPath, file.id).run();
      if (copied.ok && !copied.skipped) await r2.delete(fromKey).catch(() => {});
    }
  }
}

export async function deleteFolder(id: string) {
  const db = await getDB();
  const r2 = await getR2();
  const path = await folderPathById(id);
  if (path == null) throw new Error("not-found");
  const files = await db
    .prepare("SELECT * FROM files WHERE path = ? OR path LIKE ? ESCAPE '\\'")
    .bind(path, `${escapeLike(path)}/%`)
    .all<FileRow>();
  for (const file of files.results || []) {
    await r2.delete(fileKey(file.path, file.name));
  }
  await db
    .prepare("DELETE FROM files WHERE path = ? OR path LIKE ? ESCAPE '\\'")
    .bind(path, `${escapeLike(path)}/%`)
    .run();

  const folders = await db.prepare("SELECT * FROM folders").all<FolderRow>();
  const tree = buildTree(folders.results || []);
  const ids = collectIds(tree, id);
  if (ids.length) {
    // D1 绑定参数上限 100——分块删除（子目录 >90 时避免 500）
    for (const chunk of chunkIds(ids)) {
      const placeholders = chunk.map(() => "?").join(",");
      await db.prepare(`DELETE FROM folders WHERE id IN (${placeholders})`).bind(...chunk).run();
    }
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
       FROM files WHERE deleted_at IS NULL`,
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
      "SELECT * FROM files WHERE deleted_at IS NULL AND expires IS NOT NULL AND expires >= ? AND expires < ? ORDER BY expires ASC LIMIT 8",
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

export async function purgeExpired(graceDays: number): Promise<{ deleted: number; batches: number }> {
  const days = Math.max(0, Math.floor(graceDays));
  const cutoff = new Date(Date.now() - days * 86400e3).toISOString();
  const db = await getDB();
  let deleted = 0;
  let batches = 0;
  for (let i = 0; i < 20; i++) {
    const rows = await db
      .prepare(
        "SELECT id FROM files WHERE expires IS NOT NULL AND expires < ? ORDER BY expires ASC LIMIT 50",
      )
      .bind(cutoff)
      .all<{ id: string }>();
    const ids = (rows.results || []).map((r) => r.id);
    if (!ids.length) break;
    const result = await deleteFiles(ids);
    deleted += result.deleted;
    batches += 1;
    if (ids.length < 50) break;
  }
  return { deleted, batches };
}

export async function purgeTrash(): Promise<{ deleted: number; batches: number }> {
  const cutoff = trashCutoffIso();
  const db = await getDB();
  let deleted = 0;
  let batches = 0;
  for (let i = 0; i < 20; i++) {
    const rows = await db
      .prepare(
        "SELECT id FROM files WHERE deleted_at IS NOT NULL AND deleted_at < ? ORDER BY deleted_at ASC LIMIT 50",
      )
      .bind(cutoff)
      .all<{ id: string }>();
    const ids = (rows.results || []).map((r) => r.id);
    if (!ids.length) break;
    const result = await deleteFiles(ids);
    deleted += result.deleted;
    batches += 1;
    if (ids.length < 50) break;
  }
  return { deleted, batches };
}

export async function folderPathExists(path: string): Promise<boolean> {
  if (path === "") return true;
  const folders = await listFolders();
  return flattenFolderPaths(folders).some((f) => f.path === path);
}

export async function moveFiles(
  ids: string[],
  destPath: string,
  newName?: string,
): Promise<{ moved: number }> {
  if (!ids.length) return { moved: 0 };
  if (newName != null && ids.length !== 1) throw new Error("rename-single");
  let dest = destPath;
  if (dest) {
    const keyRes = sanitizeKey(dest);
    if (keyRes.error || !keyRes.value) throw new Error(keyRes.error || "bad-path");
    dest = keyRes.value;
  }
  if (!(await folderPathExists(dest))) throw new Error("folder-not-found");

  let nameOverride: string | undefined;
  if (newName != null) {
    const clean = sanitizeFileName(newName);
    if (clean.error || !clean.value) throw new Error(clean.error || "invalid-name");
    nameOverride = clean.value;
  }

  const db = await getDB();
  const r2 = await getR2();
  // D1 绑定参数上限 100——分块查询
  const files: FileRow[] = [];
  for (const chunk of chunkIds(ids)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
      .bind(...chunk)
      .all<FileRow>();
    files.push(...(rows.results || []));
  }
  if (!files.length) throw new Error("not-found");

  let moved = 0;
  for (const file of files) {
    const nextName = nameOverride ?? file.name;
    const nextPath = dest;
    const fromKey = fileKey(file.path, file.name);
    const toKey = fileKey(nextPath, nextName);
    if (fromKey === toKey) continue;

    const clash = await db
      .prepare("SELECT id FROM files WHERE path = ? AND name = ? AND deleted_at IS NULL AND id != ?")
      .bind(nextPath, nextName, file.id)
      .first<{ id: string }>();
    if (clash) throw new Error("file-exists");

    const copied = await copyObject(fromKey, toKey);
    await db
      .prepare("UPDATE files SET path = ?, name = ? WHERE id = ?")
      .bind(nextPath, nextName, file.id)
      .run();
    if (copied.ok && !copied.skipped) await r2.delete(fromKey);
    moved += 1;
  }
  return { moved };
}

export async function copyFiles(
  ids: string[],
  destPath: string,
): Promise<{ copied: number; results: CopyItemResult[] }> {
  if (!ids.length) return { copied: 0, results: [] };
  let dest = destPath;
  if (dest) {
    const keyRes = sanitizeKey(dest);
    if (keyRes.error || !keyRes.value) throw new Error(keyRes.error || "bad-path");
    dest = keyRes.value;
  }
  if (!(await folderPathExists(dest))) throw new Error("folder-not-found");

  const db = await getDB();
  const results: CopyItemResult[] = [];
  let copied = 0;

  for (const id of ids) {
    const file = await getFileById(id);
    const clash = file
      ? await db
          .prepare("SELECT id FROM files WHERE path = ? AND name = ? AND deleted_at IS NULL")
          .bind(dest, file.name)
          .first<{ id: string }>()
      : null;
    const decision = decideCopyItem(file, dest, Boolean(clash));
    if (decision !== "copy" || !file) {
      results.push({ id, ok: false, error: decision === "copy" ? "not-found" : decision });
      continue;
    }

    const fromKey = fileKey(file.path, file.name);
    const toKey = fileKey(dest, file.name);
    const objectCopy = await copyObject(fromKey, toKey);
    if (!objectCopy.ok) {
      results.push({ id, ok: false, error: objectCopy.error });
      continue;
    }

    const newId = crypto.randomUUID();
    try {
      await insertFileRecord({
        id: newId,
        name: file.name,
        path: dest,
        size: file.size,
        mime: file.mime,
        expires: file.expires,
        created_at: new Date().toISOString(),
        tags: file.tags,
        download_count: 0,
        starred: 0,
        sha256: file.sha256,
      });
    } catch (err) {
      if (objectCopy.ok && !objectCopy.skipped) {
        const r2 = await getR2();
        await r2.delete(toKey).catch(() => {});
      }
      if (/UNIQUE/i.test(String((err as Error).message || err))) {
        results.push({ id, ok: false, error: "file-exists" });
        continue;
      }
      throw err;
    }
    copied += 1;
    results.push({ id, ok: true, newId });
  }
  return { copied, results };
}

export async function findAliveBySha256(sha256: string): Promise<FileRow | null> {
  const hash = normalizeSha256(sha256);
  if (!hash) return null;
  const db = await getDB();
  const row =
    (await db
      .prepare(
        "SELECT * FROM files WHERE sha256 = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
      )
      .bind(hash)
      .first<FileRow>()) || null;
  return row ? normalizeFileRow(row) : null;
}

export async function instantCopy(opts: {
  sha256: string;
  name: string;
  path: string;
  expires: string | null;
  mime?: string | null;
}): Promise<{ id: string; key: string; size: number; mime: string | null } | { error: string }> {
  const hash = normalizeSha256(opts.sha256);
  if (!hash) return { error: "bad-sha256" };
  const src = await findAliveBySha256(hash);
  if (!src) return { error: "miss" };
  const destKey = fileKey(opts.path, opts.name);
  const srcKey = fileKey(src.path, src.name);
  const existing = await getFileByKey(destKey);
  if (existing) {
    if (existing.sha256 === hash) {
      return { id: existing.id, key: destKey, size: existing.size, mime: existing.mime };
    }
    return { error: "file-exists" };
  }
  if (srcKey !== destKey) {
    const copied = await copyObject(
      srcKey,
      destKey,
      opts.expires ? { customMetadata: { expires: opts.expires } } : undefined,
    );
    if (!copied.ok) return { error: "miss" };
  }
  const id = crypto.randomUUID();
  const mime = opts.mime || src.mime;
  await upsertFile({
    id,
    name: opts.name,
    path: opts.path,
    size: src.size,
    mime,
    expires: opts.expires,
    created_at: new Date().toISOString(),
    tags: "",
    starred: 0,
    sha256: hash,
  });
  return { id, key: destKey, size: src.size, mime };
}

export function assertKey(raw: string) {
  const key = sanitizeKey(raw);
  if (key.error || !key.value) {
    throw new Error(key.error || "bad-key");
  }
  return key.value;
}
