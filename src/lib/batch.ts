import { fileKey, isExpired, MAX_BATCH_IDS, type FileRow } from "./types";

export { MAX_BATCH_IDS };
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

function chunkIds(ids: string[], size = 90): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export function generateBatchToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function batchSharePaths(token: string): { previewUrl: string; downloadUrl: string } {
  const previewUrl = `/dl/batch/${encodeURIComponent(token)}`;
  return { previewUrl, downloadUrl: `${previewUrl}?mode=download` };
}

export function parseBatchIds(body: unknown): { ids: string[]; error?: string } {
  if (!body || typeof body !== "object") return { ids: [], error: "need ids" };
  const raw = (body as { ids?: unknown }).ids;
  if (!Array.isArray(raw)) return { ids: [], error: "need ids" };
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (!ids.length) return { ids: [], error: "need ids" };
  if (ids.length > MAX_BATCH_IDS) return { ids: [], error: "too many ids" };
  return { ids };
}

export function parseFileIdsJson(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

/** Shortest file expiry; no expiry on any file → permanent (null). */
export function shortestExpiry(files: { expires: string | null }[]): string | null {
  let min: string | null = null;
  for (const file of files) {
    if (!file.expires) continue;
    if (min == null || file.expires < min) min = file.expires;
  }
  return min;
}

export async function getFilesByIds(db: D1Database, ids: string[]): Promise<FileRow[]> {
  if (!ids.length) return [];
  const found = new Map<string, FileRow>();
  for (const chunk of chunkIds(ids)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT * FROM files WHERE id IN (${placeholders})`)
      .bind(...chunk)
      .all<FileRow>();
    for (const row of rows.results || []) found.set(row.id, row);
  }
  return ids.map((id) => found.get(id)).filter((row): row is FileRow => Boolean(row));
}

export async function insertBatch(db: D1Database, row: BatchLink): Promise<void> {
  await db
    .prepare("INSERT INTO batch_links (token, file_ids, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(row.token, row.file_ids, row.created_at, row.expires_at)
    .run();
}

export async function getBatch(db: D1Database, token: string): Promise<BatchLink | null> {
  if (!token) return null;
  return (
    (await db
      .prepare("SELECT token, file_ids, created_at, expires_at FROM batch_links WHERE token = ?")
      .bind(token)
      .first<BatchLink>()) || null
  );
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

export async function deleteExpiredBatches(db: D1Database, now = new Date()): Promise<number> {
  const nowIso = now.toISOString();
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
}

export function downloadableFiles(files: FileRow[], origin: string, now = Date.now()): { url: string; name: string }[] {
  return files
    .filter((file) => !isExpired(file.expires, now))
    .map((file) => ({
      url: `${origin.replace(/\/$/, "")}/dl/${fileKey(file.path, file.name)
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      name: file.name,
    }));
}
