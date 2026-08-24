import type { ApiListResponse, ShareDto, ShareStatus } from "@/lib/v2-contracts";
import {
  hashSharePassword,
  isShareLocked,
  lockUntilIso,
  mintUnlockCookie,
  parseCookieHeader,
  shareCookieName,
  verifySharePassword,
  verifyUnlockCookie,
} from "@/lib/share-password";
import { generateShareToken, randomBase62 } from "@/lib/share-token";
import { decodeCursor, encodeCursor } from "./cursor";
import { DomainError, notFound } from "./errors";
import { getFileRecord, type FileRecord } from "./files";

type ShareRecord = {
  token: string;
  kind: "file" | "batch";
  password_hash: string | null;
  max_downloads: number | null;
  created_at: string;
  expires_at: string | null;
  revoked: number;
  fail_count: number;
  locked_until: string | null;
  allow_preview: number;
  allow_download: number;
};

type ShareItemRecord = {
  share_token: string;
  file_id: string;
  position: number;
  download_count: number;
  name: string;
  mime: string | null;
  size: number;
  expires_at: string | null;
  deleted_at: string | null;
  storage_key: string;
  blob_state: "active" | "delete_pending";
};

type ShareCodeRecord = { share_token: string; code: string; mode: "download" | "preview" };

export type PublicShareFile = {
  id: string;
  name: string;
  mime: string | null;
  size: number;
  expiresAt: string | null;
  downloadCount: number;
  previewUrl: string;
  downloadUrl: string;
};

export type PublicShare = {
  token: string;
  code: string;
  mode: "download" | "preview";
  kind: "file" | "batch";
  hasPassword: boolean;
  lockedUntil: string | null;
  expiresAt: string | null;
  allowPreview: boolean;
  allowDownload: boolean;
  status: ShareStatus;
  files: PublicShareFile[];
};

const ITEM_SELECT = `
  SELECT si.share_token, si.file_id, si.position, si.download_count,
    f.name, f.mime, f.expires_at, f.deleted_at,
    b.size, b.storage_key, b.state AS blob_state
  FROM share_items si
  JOIN files f ON f.id = si.file_id
  JOIN blobs b ON b.id = f.blob_id`;

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(",");
}

function shareStatus(share: ShareRecord, items: ShareItemRecord[], now = Date.now()): ShareStatus {
  if (share.revoked) return "revoked";
  if (!items.length) return "expired";
  if (share.expires_at && new Date(share.expires_at).getTime() < now) return "expired";
  if (items.some((item) => item.deleted_at || item.blob_state !== "active" || (item.expires_at && new Date(item.expires_at).getTime() < now))) {
    return "expired";
  }
  if (share.max_downloads && items.length && items.every((item) => item.download_count >= Number(share.max_downloads))) return "exhausted";
  return "active";
}

function toShareDto(share: ShareRecord, items: ShareItemRecord[], codes: ShareCodeRecord[]): ShareDto {
  const downloadCode = codes.find((code) => code.mode === "download")?.code || "";
  const previewCode = codes.find((code) => code.mode === "preview")?.code || "";
  return {
    token: share.token,
    kind: share.kind,
    fileIds: items.map((item) => item.file_id),
    label: items.length === 1 ? items[0]!.name : `${items[0]?.name || "Files"} +${Math.max(0, items.length - 1)}`,
    hasPassword: Boolean(share.password_hash),
    maxDownloads: share.max_downloads == null ? null : Number(share.max_downloads),
    downloadCount: items.reduce((total, item) => total + Number(item.download_count), 0),
    createdAt: share.created_at,
    expiresAt: share.expires_at,
    revoked: Boolean(share.revoked),
    allowDownload: Boolean(share.allow_download),
    allowPreview: Boolean(share.allow_preview),
    downloadUrl: downloadCode ? `/s/${downloadCode}` : "",
    previewUrl: previewCode ? `/p/${previewCode}` : "",
    status: shareStatus(share, items),
  };
}

async function allocateCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = randomBase62(10);
    const hit = await db.prepare("SELECT code FROM share_codes WHERE code = ?").bind(code).first();
    if (!hit) return code;
  }
  throw new DomainError("share-code-exhausted", 503);
}

async function readItems(db: D1Database, tokens: string[]): Promise<ShareItemRecord[]> {
  if (!tokens.length) return [];
  const rows = await db
    .prepare(`${ITEM_SELECT} WHERE si.share_token IN (${placeholders(tokens)}) ORDER BY si.share_token, si.position`)
    .bind(...tokens)
    .all<ShareItemRecord>();
  return rows.results || [];
}

async function readCodes(db: D1Database, tokens: string[]): Promise<ShareCodeRecord[]> {
  if (!tokens.length) return [];
  const rows = await db
    .prepare(`SELECT share_token, code, mode FROM share_codes WHERE share_token IN (${placeholders(tokens)})`)
    .bind(...tokens)
    .all<ShareCodeRecord>();
  return rows.results || [];
}

export async function createShare(
  db: D1Database,
  input: {
    fileIds: string[];
    password?: string | null;
    maxDownloads?: number | null;
    expiresAt?: string | null;
    allowDownload: boolean;
    allowPreview: boolean;
  },
): Promise<ShareDto> {
  const fileIds = [...new Set(input.fileIds)];
  const files = await Promise.all(fileIds.map((id) => getFileRecord(db, id)));
  const earliestFileExpiry = files
    .map((file) => file.expires_at)
    .filter((value): value is string => Boolean(value))
    .sort()[0] || null;
  const expiresAt = input.expiresAt ?? earliestFileExpiry;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) throw new DomainError("share-expiry-in-past", 400, "expiresAt");
  const token = generateShareToken();
  const [downloadCode, passwordHash] = await Promise.all([
    allocateCode(db),
    input.password ? hashSharePassword(input.password) : Promise.resolve(null),
  ]);
  let previewCode = await allocateCode(db);
  while (previewCode === downloadCode) previewCode = await allocateCode(db);
  const now = new Date().toISOString();
  const share: ShareRecord = {
    token,
    kind: files.length === 1 ? "file" : "batch",
    password_hash: passwordHash,
    max_downloads: input.maxDownloads ?? null,
    created_at: now,
    expires_at: expiresAt,
    revoked: 0,
    fail_count: 0,
    locked_until: null,
    allow_preview: input.allowPreview ? 1 : 0,
    allow_download: input.allowDownload ? 1 : 0,
  };
  await db.batch([
    db.prepare(`INSERT INTO shares (token, kind, password_hash, max_downloads, created_at, expires_at, allow_preview, allow_download)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(token, share.kind, passwordHash, share.max_downloads, now, expiresAt, share.allow_preview, share.allow_download),
    ...files.map((file, position) => db.prepare("INSERT INTO share_items (share_token, file_id, position) VALUES (?, ?, ?)").bind(token, file.id, position)),
    db.prepare("INSERT INTO share_codes (code, share_token, mode) VALUES (?, ?, 'download')").bind(downloadCode, token),
    db.prepare("INSERT INTO share_codes (code, share_token, mode) VALUES (?, ?, 'preview')").bind(previewCode, token),
  ]);
  const items: ShareItemRecord[] = files.map((file, position) => ({
    share_token: token,
    file_id: file.id,
    position,
    download_count: 0,
    name: file.name,
    mime: file.mime,
    size: Number(file.size),
    expires_at: file.expires_at,
    deleted_at: file.deleted_at,
    storage_key: file.storage_key,
    blob_state: file.blob_state,
  }));
  return toShareDto(share, items, [
    { share_token: token, code: downloadCode, mode: "download" },
    { share_token: token, code: previewCode, mode: "preview" },
  ]);
}

export async function listShares(
  db: D1Database,
  opts: { query?: string; cursor?: string | null; limit?: number },
): Promise<ApiListResponse<ShareDto>> {
  const limit = Math.min(100, Math.max(10, opts.limit || 50));
  const cursor = decodeCursor(opts.cursor);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  const query = (opts.query || "").trim();
  if (query) {
    clauses.push(`(s.token LIKE ? OR EXISTS (SELECT 1 FROM share_codes sc WHERE sc.share_token = s.token AND sc.code LIKE ?)
      OR EXISTS (SELECT 1 FROM share_items si JOIN files f ON f.id = si.file_id WHERE si.share_token = s.token AND f.name LIKE ?))`);
    binds.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countStatement = db.prepare(`SELECT COUNT(*) AS n FROM shares s ${where}`).bind(...binds);
  const pageClauses = [...clauses];
  const pageBinds = [...binds];
  if (cursor) {
    pageClauses.push("(s.created_at < ? OR (s.created_at = ? AND s.token < ?))");
    pageBinds.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const pageWhere = pageClauses.length ? `WHERE ${pageClauses.join(" AND ")}` : "";
  const pageStatement = db.prepare(`SELECT * FROM shares s ${pageWhere} ORDER BY s.created_at DESC, s.token DESC LIMIT ?`).bind(...pageBinds, limit + 1);
  const [countResult, pageResult] = await db.batch([countStatement, pageStatement]);
  const rows = (pageResult.results || []) as ShareRecord[];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const tokens = visible.map((row) => row.token);
  const [items, codes] = await Promise.all([readItems(db, tokens), readCodes(db, tokens)]);
  const last = visible.at(-1);
  return {
    data: visible.map((share) => toShareDto(
      share,
      items.filter((item) => item.share_token === share.token),
      codes.filter((code) => code.share_token === share.token),
    )),
    meta: {
      total: Number((countResult.results?.[0] as { n?: number } | undefined)?.n || 0),
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.token }) : null,
    },
  };
}

export async function patchShare(
  db: D1Database,
  token: string,
  patch: {
    password?: string | null;
    maxDownloads?: number | null;
    expiresAt?: string | null;
    revoked?: boolean;
    allowDownload?: boolean;
    allowPreview?: boolean;
  },
): Promise<ShareDto> {
  const current = await db.prepare("SELECT * FROM shares WHERE token = ?").bind(token).first<ShareRecord>();
  if (!current) notFound("share-not-found");
  const nextDownload = patch.allowDownload ?? Boolean(current.allow_download);
  const nextPreview = patch.allowPreview ?? Boolean(current.allow_preview);
  if (!nextDownload && !nextPreview) throw new DomainError("need-download-or-preview", 400, "allowDownload");
  if (patch.expiresAt && new Date(patch.expiresAt).getTime() <= Date.now()) throw new DomainError("share-expiry-in-past", 400, "expiresAt");
  const sets: string[] = [];
  const binds: unknown[] = [];
  const add = (column: string, value: unknown) => { sets.push(`${column} = ?`); binds.push(value); };
  if (patch.password !== undefined) add("password_hash", patch.password ? await hashSharePassword(patch.password) : null);
  if (patch.maxDownloads !== undefined) add("max_downloads", patch.maxDownloads);
  if (patch.expiresAt !== undefined) add("expires_at", patch.expiresAt);
  if (patch.revoked !== undefined) add("revoked", patch.revoked ? 1 : 0);
  if (patch.allowDownload !== undefined) add("allow_download", patch.allowDownload ? 1 : 0);
  if (patch.allowPreview !== undefined) add("allow_preview", patch.allowPreview ? 1 : 0);
  if (!sets.length) throw new DomainError("empty-patch", 400);
  const result = await db.prepare(`UPDATE shares SET ${sets.join(", ")} WHERE token = ?`).bind(...binds, token).run();
  if (!result.meta.changes) notFound("share-not-found");
  const share = await db.prepare("SELECT * FROM shares WHERE token = ?").bind(token).first<ShareRecord>();
  if (!share) notFound("share-not-found");
  const [items, codes] = await Promise.all([readItems(db, [token]), readCodes(db, [token])]);
  return toShareDto(share, items, codes);
}

export async function deleteShare(db: D1Database, token: string): Promise<void> {
  const result = await db.prepare("DELETE FROM shares WHERE token = ?").bind(token).run();
  if (!result.meta.changes) notFound("share-not-found");
}

export async function getPublicShare(db: D1Database, code: string): Promise<PublicShare> {
  const hit = await db.prepare(`SELECT s.*, sc.code, sc.mode FROM share_codes sc JOIN shares s ON s.token = sc.share_token WHERE sc.code = ?`)
    .bind(code)
    .first<ShareRecord & { code: string; mode: "download" | "preview" }>();
  if (!hit) notFound("share-not-found");
  const items = await readItems(db, [hit.token]);
  const status = shareStatus(hit, items);
  return {
    token: hit.token,
    code,
    mode: hit.mode,
    kind: hit.kind,
    hasPassword: Boolean(hit.password_hash),
    lockedUntil: hit.locked_until,
    expiresAt: hit.expires_at,
    allowPreview: Boolean(hit.allow_preview),
    allowDownload: Boolean(hit.allow_download),
    status,
    files: items.map((item) => ({
      id: item.file_id,
      name: item.name,
      mime: item.mime,
      size: Number(item.size),
      expiresAt: item.expires_at,
      downloadCount: Number(item.download_count),
      previewUrl: `/c/${encodeURIComponent(code)}/${encodeURIComponent(item.file_id)}?inline=1`,
      downloadUrl: `/c/${encodeURIComponent(code)}/${encodeURIComponent(item.file_id)}`,
    })),
  };
}

export async function authorizePublicShare(
  db: D1Database,
  input: { code: string; fileId?: string; cookieHeader?: string | null; intent: "page" | "preview" | "download" },
): Promise<{ share: PublicShare; file?: FileRecord; item?: PublicShareFile }> {
  const share = await getPublicShare(db, input.code);
  if (share.status !== "active") throw new DomainError(`share-${share.status}`, share.status === "expired" ? 410 : 403);
  if (input.intent === "page" && share.mode === "preview" && !share.allowPreview) throw new DomainError("preview-not-allowed", 403);
  if (input.intent === "page" && share.mode === "download" && !share.allowDownload) throw new DomainError("download-not-allowed", 403);
  if (input.intent === "preview" && (!share.allowPreview || share.mode !== "preview")) throw new DomainError("preview-not-allowed", 403);
  if (input.intent === "download" && !share.allowDownload) throw new DomainError("download-not-allowed", 403);
  if (share.hasPassword) {
    const row = await db.prepare("SELECT password_hash FROM shares WHERE token = ?").bind(share.token).first<{ password_hash: string }>();
    const cookie = parseCookieHeader(input.cookieHeader)[shareCookieName(share.token)] || "";
    if (!row?.password_hash || !(await verifyUnlockCookie(row.password_hash, share.token, cookie))) {
      throw new DomainError("share-password-required", 401);
    }
  }
  if (!input.fileId) return { share };
  const item = share.files.find((candidate) => candidate.id === input.fileId);
  if (!item) notFound("share-file-not-found");
  const row = await db.prepare("SELECT max_downloads FROM shares WHERE token = ?").bind(share.token).first<{ max_downloads: number | null }>();
  if (row?.max_downloads && item.downloadCount >= Number(row.max_downloads)) throw new DomainError("share-exhausted", 410);
  return { share, item, file: await getFileRecord(db, input.fileId) };
}

export async function verifyPublicSharePassword(
  db: D1Database,
  code: string,
  password: string,
): Promise<{ token: string; cookie: string }> {
  const share = await getPublicShare(db, code);
  const row = await db.prepare("SELECT password_hash, fail_count, locked_until FROM shares WHERE token = ?").bind(share.token)
    .first<{ password_hash: string | null; fail_count: number; locked_until: string | null }>();
  if (!row?.password_hash) throw new DomainError("share-has-no-password", 400);
  if (isShareLocked(row.locked_until)) throw new DomainError("share-locked", 429);
  if (!(await verifySharePassword(row.password_hash, password))) {
    const failCount = Number(row.fail_count || 0) + 1;
    await db.prepare("UPDATE shares SET fail_count = ?, locked_until = ? WHERE token = ?")
      .bind(failCount >= 5 ? 0 : failCount, failCount >= 5 ? lockUntilIso() : null, share.token)
      .run();
    throw new DomainError(failCount >= 5 ? "share-locked" : "wrong-password", failCount >= 5 ? 429 : 401);
  }
  await db.prepare("UPDATE shares SET fail_count = 0, locked_until = NULL WHERE token = ?").bind(share.token).run();
  return { token: share.token, cookie: await mintUnlockCookie(row.password_hash, share.token) };
}

export async function incrementPublicDownload(db: D1Database, token: string, fileId: string): Promise<void> {
  const reserved = await db.prepare(`UPDATE share_items SET download_count = download_count + 1
    WHERE share_token = ? AND file_id = ? AND (
      (SELECT max_downloads FROM shares WHERE token = ?) IS NULL OR
      download_count < (SELECT max_downloads FROM shares WHERE token = ?)
    )`).bind(token, fileId, token, token).run();
  if (!reserved.meta.changes) throw new DomainError("share-exhausted", 410);
  await db.prepare("UPDATE files SET download_count = download_count + 1 WHERE id = ?").bind(fileId).run();
}
