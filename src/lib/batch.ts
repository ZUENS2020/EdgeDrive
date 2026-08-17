import { getFilesByIds, parseBatchIds, parseFileIdsJson, shortestExpiry } from "./file-ids";
import { generateShareToken } from "./share-token";
import { batchSharePaths } from "./share-urls";
import { encodeDlPath, fileKey, isExpired, MAX_BATCH_IDS, type FileRow } from "./types";

export { MAX_BATCH_IDS, getFilesByIds, parseBatchIds, parseFileIdsJson, shortestExpiry };
export { batchSharePaths } from "./share-urls";
export const DOWNLOAD_STAGGER_MS = 300;

export type BatchLink = {
  token: string;
  file_ids: string;
  created_at: string;
  expires_at: string | null;
};

export type CreateBatchOk = {
  ok: true;
  previewUrl: string;
  downloadUrl: string;
  count: number;
  expiresAt: string | null;
};

export type CreateBatchErr = {
  ok: false;
  status: number;
  error: string;
};

export type CreateBatchResult = CreateBatchOk | CreateBatchErr;

export type BatchPageOk = {
  status: 200;
  batch: BatchLink;
  files: FileRow[];
};

export type BatchPageResult = { status: 404 } | { status: 410 } | BatchPageOk;

export const generateBatchToken = generateShareToken;

function toBatchLink(row: {
  token: string;
  target: string;
  created_at: string;
  expires_at: string | null;
}): BatchLink {
  return {
    token: row.token,
    file_ids: row.target,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

export async function insertBatch(db: D1Database, row: BatchLink): Promise<void> {
  await db
    .prepare(
      `INSERT INTO share_links (
        token, kind, target, password_hash, max_downloads, download_count,
        created_at, expires_at, revoked, short_code, fail_count, locked_until
      ) VALUES (?, 'batch', ?, NULL, NULL, 0, ?, ?, 0, NULL, 0, NULL)`,
    )
    .bind(row.token, row.file_ids, row.created_at, row.expires_at)
    .run();
}

export async function getBatch(db: D1Database, token: string): Promise<BatchLink | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      "SELECT token, target, created_at, expires_at FROM share_links WHERE token = ? AND kind = 'batch'",
    )
    .bind(token)
    .first<{ token: string; target: string; created_at: string; expires_at: string | null }>();
  return row ? toBatchLink(row) : null;
}

export async function createBatch(
  db: D1Database,
  ids: string[],
  now = new Date(),
): Promise<{ token: string; expiresAt: string | null; count: number } | { error: string; status: number }> {
  if (!ids.length) return { error: "need ids", status: 400 };
  if (ids.length > MAX_BATCH_IDS) return { error: "too many ids", status: 400 };
  const files = await getFilesByIds(db, ids);
  if (files.length !== ids.length) return { error: "files not found", status: 400 };
  const token = generateBatchToken();
  const createdAt = now.toISOString();
  const expiresAt = shortestExpiry(files);
  await insertBatch(db, {
    token,
    file_ids: JSON.stringify(ids),
    created_at: createdAt,
    expires_at: expiresAt,
  });
  return { token, expiresAt, count: files.length };
}

export async function handleCreateBatch(
  db: D1Database,
  body: unknown,
  now = new Date(),
): Promise<CreateBatchResult> {
  const parsed = parseBatchIds(body);
  if (parsed.error) return { ok: false, status: 400, error: parsed.error };
  const created = await createBatch(db, parsed.ids, now);
  if ("error" in created) return { ok: false, status: created.status, error: created.error };
  const paths = batchSharePaths(created.token);
  return {
    ok: true,
    previewUrl: paths.previewUrl,
    downloadUrl: paths.downloadUrl,
    count: created.count,
    expiresAt: created.expiresAt,
  };
}

export async function resolveBatchPage(
  db: D1Database,
  token: string,
  now = Date.now(),
): Promise<BatchPageResult> {
  const trimmed = (token || "").trim();
  if (!trimmed) return { status: 404 };
  const batch = await getBatch(db, trimmed);
  if (!batch) return { status: 404 };
  if (isExpired(batch.expires_at, now)) return { status: 410 };
  const ids = parseFileIdsJson(batch.file_ids);
  const files = await getFilesByIds(db, ids);
  return { status: 200, batch, files };
}

/** Legacy batch_links cleanup only. share_links rows are kept for history. */
export async function deleteExpiredBatches(db: D1Database, now = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  try {
    const rows = await db
      .prepare("SELECT token FROM batch_links WHERE expires_at IS NOT NULL AND expires_at < ?")
      .bind(nowIso)
      .all<{ token: string }>();
    const tokens = (rows.results || []).map((r) => r.token);
    if (!tokens.length) return 0;
    await db
      .prepare("DELETE FROM batch_links WHERE expires_at IS NOT NULL AND expires_at < ?")
      .bind(nowIso)
      .run();
    return tokens.length;
  } catch {
    return 0;
  }
}

export function downloadableFiles(
  files: FileRow[],
  origin: string,
  now = Date.now(),
  token?: string,
  packOnly = false,
): { url: string; name: string }[] {
  const base = origin.replace(/\/$/, "");
  return files
    .filter((file) => !isExpired(file.expires, now))
    .map((file) => {
      const path = encodeDlPath(fileKey(file.path, file.name));
      const qs = token
        ? `?t=${encodeURIComponent(token)}${packOnly ? "&bundle=1" : ""}`
        : "";
      return { url: `${base}/dl/${path}${qs}`, name: file.name };
    });
}
