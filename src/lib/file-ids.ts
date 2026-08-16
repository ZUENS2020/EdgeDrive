import { MAX_BATCH_IDS, type FileRow } from "./types";

export { MAX_BATCH_IDS };

function chunkIds(ids: string[], size = 90): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
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
      .prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
      .bind(...chunk)
      .all<FileRow>();
    for (const row of rows.results || []) {
      if (row.deleted_at) continue;
      found.set(row.id, row);
    }
  }
  return ids.map((id) => found.get(id)).filter((row): row is FileRow => Boolean(row));
}
