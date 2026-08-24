import type { ApiListResponse, FileDto, FileScope, FolderDto, OverviewDto } from "@/lib/v2-contracts";
import { sanitizeFileName, sanitizeFolderName } from "@/lib/sanitize";
import { decodeCursor, encodeCursor } from "./cursor";
import { conflict, DomainError, notFound } from "./errors";

export type FileRecord = {
  id: string;
  blob_id: string;
  folder_id: string | null;
  name: string;
  mime: string | null;
  expires_at: string | null;
  download_count: number;
  starred: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  storage_key: string;
  sha256: string;
  size: number;
  blob_state: "active" | "delete_pending";
};

type FolderRecord = {
  id: string;
  parent_id: string | null;
  name: string;
  deleted_at: string | null;
};

const FILE_SELECT = `
  SELECT f.*, b.storage_key, b.sha256, b.size, b.state AS blob_state
  FROM files f JOIN blobs b ON b.id = f.blob_id`;

function toFileDto(row: FileRecord, now = Date.now()): FileDto {
  const expired = Boolean(row.expires_at && new Date(row.expires_at).getTime() < now);
  return {
    id: row.id,
    blobId: row.blob_id,
    folderId: row.folder_id,
    name: row.name,
    mime: row.mime,
    size: Number(row.size),
    sha256: row.sha256,
    expiresAt: row.expires_at,
    downloadCount: Number(row.download_count),
    starred: Boolean(row.starred),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    expired,
    contentUrl: `/api/admin/files/${encodeURIComponent(row.id)}/content`,
    previewUrl: `/admin/files/${encodeURIComponent(row.id)}/preview`,
  };
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(",");
}

export function cleanFileName(raw: string): string {
  const parsed = sanitizeFileName(raw);
  if (parsed.error || !parsed.value) throw new DomainError(parsed.error || "invalid-name", 400, "name");
  return parsed.value;
}

export async function assertFolder(db: D1Database, folderId: string | null): Promise<void> {
  if (!folderId) return;
  const row = await db
    .prepare("SELECT id FROM folders WHERE id = ? AND deleted_at IS NULL")
    .bind(folderId)
    .first<{ id: string }>();
  if (!row) throw new DomainError("folder-not-found", 404, "folderId");
}

export async function listFiles(
  db: D1Database,
  opts: {
    scope: FileScope;
    folderId?: string | null;
    query?: string;
    cursor?: string | null;
    limit?: number;
  },
): Promise<ApiListResponse<FileDto>> {
  const limit = Math.min(100, Math.max(10, opts.limit || 50));
  const cursor = decodeCursor(opts.cursor);
  const now = new Date();
  const nowIso = now.toISOString();
  const soonIso = new Date(now.getTime() + 24 * 3600_000).toISOString();
  const clauses: string[] = ["b.state = 'active'"];
  const binds: unknown[] = [];

  if (opts.scope === "trash") clauses.push("f.deleted_at IS NOT NULL");
  else clauses.push("f.deleted_at IS NULL");

  if (opts.scope === "folder") {
    if (opts.folderId) {
      clauses.push("f.folder_id = ?");
      binds.push(opts.folderId);
    } else {
      clauses.push("f.folder_id IS NULL");
    }
  } else if (opts.scope === "starred") {
    clauses.push("f.starred = 1");
  } else if (opts.scope === "expired") {
    clauses.push("f.expires_at IS NOT NULL AND f.expires_at < ?");
    binds.push(nowIso);
  } else if (opts.scope === "expiring") {
    clauses.push("f.expires_at IS NOT NULL AND f.expires_at >= ? AND f.expires_at < ?");
    binds.push(nowIso, soonIso);
  } else if (opts.scope === "recent") {
    clauses.push("f.created_at >= ?");
    binds.push(new Date(now.getTime() - 7 * 86400_000).toISOString());
  }

  const query = (opts.query || "").trim();
  if (query) {
    clauses.push("f.name LIKE ? ESCAPE '\\'");
    binds.push(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
  }

  const where = `WHERE ${clauses.join(" AND ")}`;
  const countStatement = db.prepare(`SELECT COUNT(*) AS n FROM files f JOIN blobs b ON b.id = f.blob_id ${where}`).bind(...binds);
  const pageClauses = [...clauses];
  const pageBinds = [...binds];
  if (cursor) {
    pageClauses.push("(f.created_at < ? OR (f.created_at = ? AND f.id < ?))");
    pageBinds.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const pageStatement = db
    .prepare(`${FILE_SELECT} WHERE ${pageClauses.join(" AND ")} ORDER BY f.created_at DESC, f.id DESC LIMIT ?`)
    .bind(...pageBinds, limit + 1);
  const [countResult, pageResult] = await db.batch([countStatement, pageStatement]);
  const countRow = countResult?.results?.[0] as { n?: number } | undefined;
  const rows = (pageResult?.results || []) as FileRecord[];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  return {
    data: visible.map((row) => toFileDto(row, now.getTime())),
    meta: {
      total: Number(countRow?.n || 0),
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
    },
  };
}

export async function getFileRecord(db: D1Database, id: string, includeDeleted = false): Promise<FileRecord> {
  const row = await db
    .prepare(`${FILE_SELECT} WHERE f.id = ? ${includeDeleted ? "" : "AND f.deleted_at IS NULL"}`)
    .bind(id)
    .first<FileRecord>();
  if (!row || row.blob_state !== "active") notFound("file-not-found");
  return row;
}

export async function getFileDto(db: D1Database, id: string): Promise<FileDto> {
  return toFileDto(await getFileRecord(db, id));
}

export async function listFolderTree(db: D1Database, includeDeleted = false): Promise<FolderDto[]> {
  const rows = await db
    .prepare(`SELECT id, parent_id, name, deleted_at FROM folders ${includeDeleted ? "" : "WHERE deleted_at IS NULL"} ORDER BY name COLLATE NOCASE`)
    .all<FolderRecord>();
  const records = rows.results || [];
  const byParent = new Map<string, FolderRecord[]>();
  for (const row of records) {
    const key = row.parent_id || "";
    byParent.set(key, [...(byParent.get(key) || []), row]);
  }
  const walk = (parentId: string, parentPath: string): FolderDto[] =>
    (byParent.get(parentId) || []).map((row) => {
      const path = parentPath ? `${parentPath}/${row.name}` : row.name;
      return {
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        path,
        deletedAt: row.deleted_at,
        children: walk(row.id, path),
      };
    });
  return walk("", "");
}

export async function listDeletedFolders(db: D1Database): Promise<FolderDto[]> {
  const rows = await db.prepare("SELECT id, parent_id, name, deleted_at FROM folders ORDER BY name COLLATE NOCASE").all<FolderRecord>();
  const records = rows.results || [];
  const byId = new Map(records.map((row) => [row.id, row]));
  const pathFor = (row: FolderRecord): string => {
    const names = [row.name];
    const seen = new Set([row.id]);
    let parentId = row.parent_id;
    while (parentId) {
      if (seen.has(parentId)) break;
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parent_id;
    }
    return names.join("/");
  };
  return records.filter((row) => Boolean(row.deleted_at) && !byId.get(row.parent_id || "")?.deleted_at).map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    path: pathFor(row),
    deletedAt: row.deleted_at,
    children: [],
  }));
}

export async function createFolder(db: D1Database, name: string, parentId: string | null): Promise<FolderDto> {
  const parsed = sanitizeFolderName(name);
  if (parsed.error || !parsed.value) throw new DomainError(parsed.error || "invalid-name", 400, "name");
  await assertFolder(db, parentId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db
      .prepare("INSERT INTO folders (id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, parentId, parsed.value, now, now)
      .run();
  } catch (error) {
    if (/UNIQUE/i.test(String(error))) conflict("folder-exists", "name");
    throw error;
  }
  return { id, parentId, name: parsed.value, path: parsed.value, deletedAt: null, children: [] };
}

export async function renameFolder(db: D1Database, id: string, name: string): Promise<void> {
  const parsed = sanitizeFolderName(name);
  if (parsed.error || !parsed.value) throw new DomainError(parsed.error || "invalid-name", 400, "name");
  try {
    const result = await db
      .prepare("UPDATE folders SET name = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
      .bind(parsed.value, new Date().toISOString(), id)
      .run();
    if (!result.meta.changes) notFound("folder-not-found");
  } catch (error) {
    if (/UNIQUE/i.test(String(error))) conflict("folder-exists", "name");
    throw error;
  }
}

export async function trashFolder(db: D1Database, id: string): Promise<void> {
  const exists = await db.prepare("SELECT id FROM folders WHERE id = ? AND deleted_at IS NULL").bind(id).first();
  if (!exists) notFound("folder-not-found");
  const now = new Date().toISOString();
  const subtree = `WITH RECURSIVE subtree(id) AS (SELECT id FROM folders WHERE id = ? UNION ALL SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id)`;
  await db.batch([
    db.prepare(`${subtree} UPDATE files SET deleted_at = COALESCE(deleted_at, ?), updated_at = ? WHERE folder_id IN (SELECT id FROM subtree)`).bind(id, now, now),
    db.prepare(`${subtree} UPDATE folders SET deleted_at = COALESCE(deleted_at, ?), updated_at = ? WHERE id IN (SELECT id FROM subtree)`).bind(id, now, now),
  ]);
}

export async function restoreFolder(db: D1Database, id: string): Promise<void> {
  const now = new Date().toISOString();
  const subtree = `WITH RECURSIVE subtree(id) AS (SELECT id FROM folders WHERE id = ? UNION ALL SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id)`;
  try {
    await db.batch([
      db.prepare(`${subtree} UPDATE folders SET deleted_at = NULL, updated_at = ? WHERE id IN (SELECT id FROM subtree)`).bind(id, now),
      db.prepare(`${subtree} UPDATE files SET deleted_at = NULL, updated_at = ? WHERE folder_id IN (SELECT id FROM subtree)`).bind(id, now),
    ]);
  } catch (error) {
    if (/UNIQUE/i.test(String(error))) conflict("restore-name-conflict");
    throw error;
  }
}

export async function patchFile(
  db: D1Database,
  id: string,
  patch: { name?: string; folderId?: string | null; starred?: boolean; expiresAt?: string | null },
): Promise<FileDto> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (patch.name != null) {
    sets.push("name = ?");
    binds.push(cleanFileName(patch.name));
  }
  if (patch.folderId !== undefined) {
    await assertFolder(db, patch.folderId);
    sets.push("folder_id = ?");
    binds.push(patch.folderId);
  }
  if (patch.starred !== undefined) {
    sets.push("starred = ?");
    binds.push(patch.starred ? 1 : 0);
  }
  if (patch.expiresAt !== undefined) {
    sets.push("expires_at = ?");
    binds.push(patch.expiresAt);
  }
  if (!sets.length) throw new DomainError("empty-patch", 400);
  sets.push("updated_at = ?");
  binds.push(new Date().toISOString(), id);
  try {
    const result = await db.prepare(`UPDATE files SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`).bind(...binds).run();
    if (!result.meta.changes) notFound("file-not-found");
  } catch (error) {
    if (/UNIQUE/i.test(String(error))) conflict("file-exists");
    throw error;
  }
  return getFileDto(db, id);
}

export async function batchFiles(
  db: D1Database,
  r2: R2Bucket,
  body:
    | { action: "trash" | "restore" | "purge"; ids: string[] }
    | { action: "move" | "copy"; ids: string[]; folderId: string | null }
    | { action: "star"; ids: string[]; starred: boolean }
    | { action: "expire"; ids: string[]; expiresAt: string | null },
): Promise<{ affected: number }> {
  const ids = uniqueIds(body.ids);
  if (!ids.length) throw new DomainError("need-ids", 400);
  const marks = placeholders(ids);
  const now = new Date().toISOString();
  if (body.action === "trash") {
    const result = await db.prepare(`UPDATE files SET deleted_at = ?, updated_at = ? WHERE id IN (${marks}) AND deleted_at IS NULL`).bind(now, now, ...ids).run();
    return { affected: Number(result.meta.changes || 0) };
  }
  if (body.action === "restore") {
    try {
      const result = await db.prepare(`UPDATE files SET deleted_at = NULL, updated_at = ? WHERE id IN (${marks}) AND deleted_at IS NOT NULL`).bind(now, ...ids).run();
      return { affected: Number(result.meta.changes || 0) };
    } catch (error) {
      if (/UNIQUE/i.test(String(error))) conflict("restore-name-conflict");
      throw error;
    }
  }
  if (body.action === "purge") return purgeFiles(db, r2, ids);
  if (body.action === "move") {
    await assertFolder(db, body.folderId);
    try {
      const result = await db.prepare(`UPDATE files SET folder_id = ?, updated_at = ? WHERE id IN (${marks}) AND deleted_at IS NULL`).bind(body.folderId, now, ...ids).run();
      return { affected: Number(result.meta.changes || 0) };
    } catch (error) {
      if (/UNIQUE/i.test(String(error))) conflict("file-exists");
      throw error;
    }
  }
  if (body.action === "copy") {
    await assertFolder(db, body.folderId);
    const rows = await db.prepare(`${FILE_SELECT} WHERE f.id IN (${marks}) AND f.deleted_at IS NULL`).bind(...ids).all<FileRecord>();
    const found = rows.results || [];
    if (found.length !== ids.length) notFound("file-not-found");
    const statements = found.map((row) => db
      .prepare("INSERT INTO files (id, blob_id, folder_id, name, mime, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), row.blob_id, body.folderId, row.name, row.mime, row.expires_at, now, now));
    try {
      await db.batch(statements);
    } catch (error) {
      if (/UNIQUE/i.test(String(error))) conflict("file-exists");
      throw error;
    }
    return { affected: statements.length };
  }
  if (body.action === "star") {
    const result = await db.prepare(`UPDATE files SET starred = ?, updated_at = ? WHERE id IN (${marks}) AND deleted_at IS NULL`).bind(body.starred ? 1 : 0, now, ...ids).run();
    return { affected: Number(result.meta.changes || 0) };
  }
  if (body.action === "expire") {
    const result = await db.prepare(`UPDATE files SET expires_at = ?, updated_at = ? WHERE id IN (${marks}) AND deleted_at IS NULL`).bind(body.expiresAt, now, ...ids).run();
    return { affected: Number(result.meta.changes || 0) };
  }
  throw new DomainError("unknown-action", 400);
}

export async function purgeFiles(db: D1Database, r2: R2Bucket, ids: string[]): Promise<{ affected: number }> {
  const cleanIds = uniqueIds(ids);
  if (!cleanIds.length) return { affected: 0 };
  const marks = placeholders(cleanIds);
  const rows = await db.prepare(`SELECT id, blob_id FROM files WHERE id IN (${marks})`).bind(...cleanIds).all<{ id: string; blob_id: string }>();
  const found = rows.results || [];
  const blobIds = [...new Set(found.map((row) => row.blob_id))];
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [db.prepare(`DELETE FROM files WHERE id IN (${marks})`).bind(...cleanIds)];
  for (const blobId of blobIds) {
    statements.push(db.prepare("UPDATE blobs SET state = 'delete_pending', delete_pending_at = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM files WHERE blob_id = ?)").bind(now, blobId, blobId));
  }
  statements.push(db.prepare("DELETE FROM shares WHERE NOT EXISTS (SELECT 1 FROM share_items WHERE share_token = shares.token)"));
  await db.batch(statements);
  await flushPendingBlobs(db, r2, blobIds);
  return { affected: found.length };
}

export async function flushPendingBlobs(db: D1Database, r2: R2Bucket, onlyIds?: string[]): Promise<number> {
  const binds: unknown[] = [];
  let filter = "state = 'delete_pending'";
  if (onlyIds?.length) {
    filter += ` AND id IN (${placeholders(onlyIds)})`;
    binds.push(...onlyIds);
  }
  const rows = await db.prepare(`SELECT id, storage_key FROM blobs WHERE ${filter} LIMIT 100`).bind(...binds).all<{ id: string; storage_key: string }>();
  const pending = rows.results || [];
  let deleted = 0;
  for (const row of pending) {
    try {
      await r2.delete(row.storage_key);
      await db.prepare("DELETE FROM blobs WHERE id = ? AND state = 'delete_pending' AND NOT EXISTS (SELECT 1 FROM files WHERE blob_id = ?)").bind(row.id, row.id).run();
      deleted += 1;
    } catch (error) {
      console.error(JSON.stringify({ message: "blob delete deferred", blobId: row.id, error: error instanceof Error ? error.message : String(error) }));
    }
  }
  return deleted;
}

export async function overview(db: D1Database): Promise<OverviewDto> {
  const now = new Date();
  const nowIso = now.toISOString();
  const soonIso = new Date(now.getTime() + 24 * 3600_000).toISOString();
  const [filesResult, foldersResult, blobsResult, sharesResult] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS files, COALESCE(SUM(b.size), 0) AS logical_bytes, COALESCE(SUM(f.download_count), 0) AS downloads, SUM(CASE WHEN f.expires_at IS NOT NULL AND f.expires_at >= ? AND f.expires_at < ? THEN 1 ELSE 0 END) AS expiring, SUM(CASE WHEN f.expires_at IS NOT NULL AND f.expires_at < ? THEN 1 ELSE 0 END) AS expired, SUM(CASE WHEN f.deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS trash FROM files f JOIN blobs b ON b.id = f.blob_id`).bind(nowIso, soonIso, nowIso),
    db.prepare("SELECT COUNT(*) AS folders FROM folders WHERE deleted_at IS NULL"),
    db.prepare("SELECT COALESCE(SUM(size), 0) AS physical_bytes FROM blobs WHERE state = 'active'"),
    db.prepare("SELECT COUNT(*) AS active_shares FROM shares WHERE revoked = 0 AND (expires_at IS NULL OR expires_at >= ?)").bind(nowIso),
  ]);
  const file = (filesResult.results?.[0] || {}) as Record<string, number>;
  const folder = (foldersResult.results?.[0] || {}) as Record<string, number>;
  const blob = (blobsResult.results?.[0] || {}) as Record<string, number>;
  const share = (sharesResult.results?.[0] || {}) as Record<string, number>;
  const logicalBytes = Number(file.logical_bytes || 0);
  const physicalBytes = Number(blob.physical_bytes || 0);
  return {
    files: Number(file.files || 0),
    folders: Number(folder.folders || 0),
    logicalBytes,
    physicalBytes,
    savedBytes: Math.max(0, logicalBytes - physicalBytes),
    downloads: Number(file.downloads || 0),
    expiring: Number(file.expiring || 0),
    expired: Number(file.expired || 0),
    trash: Number(file.trash || 0),
    activeShares: Number(share.active_shares || 0),
  };
}
