import { parseExpireInput } from "./expires";
import { getFilesByIds, parseBatchIds, parseFileIdsJson, shortestExpiry } from "./file-ids";
import {
  hashSharePassword,
  isShareLocked,
  lockUntilIso,
  mintUnlockCookie,
  parseCookieHeader,
  safeShareNext,
  serializeShareCookie,
  SHARE_LOCK_AFTER,
  shareCookieName,
  verifySharePassword,
  verifyUnlockCookie,
} from "./share-password";
import { allocateShortCode, generateShareToken, isShortCode } from "./share-token";
import { batchSharePaths, fileLongPath, passwordPagePath, shortSharePath } from "./share-urls";
import { isExpired, type FileRow } from "./types";

export type ShareKind = "file" | "batch";

export type ShareLink = {
  token: string;
  kind: ShareKind;
  target: string;
  password_hash: string | null;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
  expires_at: string | null;
  revoked: number;
  short_code: string | null;
  fail_count: number;
  locked_until: string | null;
  allow_preview: number;
  allow_download: number;
};

export type ShareStatus = "active" | "revoked" | "expired" | "exhausted";

export type ShareLinkView = {
  token: string;
  kind: ShareKind;
  target: string;
  target_ids: string[];
  target_label: string;
  has_password: boolean;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
  expires_at: string | null;
  revoked: boolean;
  short_code: string | null;
  download_short_code: string | null;
  preview_short_code: string | null;
  url: string;
  viewUrl: string | null;
  downloadUrl: string;
  shortUrl: string | null;
  status: ShareStatus;
  allow_preview: boolean;
  allow_download: boolean;
};

export type CreateShareBody = {
  kind?: unknown;
  ids?: unknown;
  password?: unknown;
  max_downloads?: unknown;
  expires?: unknown;
  hours?: unknown;
  days?: unknown;
  permanent?: unknown;
  short?: unknown;
  reuseDefault?: unknown;
  allow_preview?: unknown;
  allow_download?: unknown;
};

export type CreateShareOk = {
  ok: true;
  token: string;
  kind: ShareKind;
  url: string;
  viewUrl: string | null;
  downloadUrl: string;
  shortUrl: string | null;
  shortCode: string | null;
  count: number;
  expiresAt: string | null;
  reused: boolean;
  hasPassword: boolean;
  allowDownload: boolean;
  allowPreview: boolean;
};

export type CreateShareErr = { ok: false; status: number; error: string };
export type CreateShareResult = CreateShareOk | CreateShareErr;

export type ShareShortMode = "download" | "view";

export type ShareModeCodes = {
  download: string | null;
  view: string | null;
};

export function isShareShortMode(value: unknown): value is ShareShortMode {
  return value === "download" || value === "view";
}

const SHARE_COLS =
  "token, kind, target, password_hash, max_downloads, download_count, created_at, expires_at, revoked, short_code, fail_count, locked_until, allow_preview, allow_download";

export function isShareKind(value: unknown): value is ShareKind {
  return value === "file" || value === "batch";
}

export function shareStatus(link: ShareLink, now = Date.now()): ShareStatus {
  if (link.revoked) return "revoked";
  if (isExpired(link.expires_at, now)) return "expired";
  if (link.kind === "file" && link.max_downloads != null && link.download_count >= link.max_downloads) {
    return "exhausted";
  }
  return "active";
}

export function shareAllowsPreview(link: Pick<ShareLink, "allow_preview"> | { allow_preview?: number | null }): boolean {
  return link.allow_preview == null || Number(link.allow_preview) !== 0;
}

export function shareAllowsDownload(
  link: Pick<ShareLink, "allow_download"> | { allow_download?: number | null },
): boolean {
  return link.allow_download == null || Number(link.allow_download) !== 0;
}

/** Batch + download-only: hide the file list, download-all uses bundle=1. */
export function sharePackOnly(
  link: Pick<ShareLink, "kind" | "allow_preview" | "allow_download"> | {
    kind: ShareKind;
    allow_preview?: number | null;
    allow_download?: number | null;
  },
): boolean {
  return link.kind === "batch" && !shareAllowsPreview(link) && shareAllowsDownload(link);
}

export function shareAllowsFile(link: ShareLink, fileId: string): boolean {
  if (link.kind === "file") return link.target === fileId;
  return parseFileIdsJson(link.target).includes(fileId);
}

export function targetIds(link: Pick<ShareLink, "kind" | "target">): string[] {
  if (link.kind === "file") return link.target ? [link.target] : [];
  return parseFileIdsJson(link.target);
}

function asInt(raw: unknown): number | null | undefined {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.floor(n);
}

function asBool(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === "1" || raw === "true";
}

function optionalPassword(raw: unknown): string | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function normalizeShareLink(row: ShareLink): ShareLink {
  return {
    ...row,
    password_hash: row.password_hash || null,
    max_downloads: row.max_downloads == null ? null : Number(row.max_downloads),
    download_count: Number(row.download_count) || 0,
    expires_at: row.expires_at || null,
    revoked: Number(row.revoked) ? 1 : 0,
    short_code: row.short_code || null,
    fail_count: Number(row.fail_count) || 0,
    locked_until: row.locked_until || null,
    allow_preview: row.allow_preview == null || Number(row.allow_preview) ? 1 : 0,
    allow_download: row.allow_download == null || Number(row.allow_download) ? 1 : 0,
  };
}

export async function getShareLink(db: D1Database, token: string): Promise<ShareLink | null> {
  const trimmed = (token || "").trim();
  if (!trimmed) return null;
  const row = await db
    .prepare(`SELECT ${SHARE_COLS} FROM share_links WHERE token = ?`)
    .bind(trimmed)
    .first<ShareLink>();
  return row ? normalizeShareLink(row) : null;
}

export async function getShareLinkByShortCode(db: D1Database, code: string): Promise<ShareLink | null> {
  const trimmed = (code || "").trim();
  if (!trimmed) return null;
  const row = await db
    .prepare(`SELECT ${SHARE_COLS} FROM share_links WHERE short_code = ?`)
    .bind(trimmed)
    .first<ShareLink>();
  return row ? normalizeShareLink(row) : null;
}

export async function getShareShortByCode(
  db: D1Database,
  code: string,
): Promise<{ code: string; token: string; mode: ShareShortMode } | null> {
  const trimmed = (code || "").trim();
  if (!trimmed) return null;
  const row = await db
    .prepare("SELECT code, token, mode FROM share_short_codes WHERE code = ?")
    .bind(trimmed)
    .first<{ code: string; token: string; mode: string }>();
  if (!row || !isShareShortMode(row.mode)) return null;
  return { code: row.code, token: row.token, mode: row.mode };
}

export async function getShareModeCodes(db: D1Database, token: string): Promise<ShareModeCodes> {
  const rows = await db
    .prepare("SELECT code, mode FROM share_short_codes WHERE token = ?")
    .bind(token)
    .all<{ code: string; mode: string }>();
  const out: ShareModeCodes = { download: null, view: null };
  for (const row of rows.results || []) {
    if (row.mode === "download") out.download = row.code;
    else if (row.mode === "view") out.view = row.code;
  }
  return out;
}

async function insertShareModeCode(
  db: D1Database,
  code: string,
  token: string,
  mode: ShareShortMode,
): Promise<void> {
  await db
    .prepare("INSERT INTO share_short_codes (code, token, mode) VALUES (?, ?, ?)")
    .bind(code, token, mode)
    .run();
}

export async function ensureShareModeCodes(
  db: D1Database,
  token: string,
): Promise<{ ok: true; download: string; view: string } | { ok: false; status: number; error: string }> {
  const existing = await getShareLink(db, token);
  if (!existing) return { ok: false, status: 404, error: "not found" };
  const current = await getShareModeCodes(db, token);
  let download = current.download;
  let view = current.view;
  try {
    if (!download) {
      download = await allocateShortCode(db);
      await insertShareModeCode(db, download, token, "download");
    }
    if (!view) {
      view = await allocateShortCode(db);
      await insertShareModeCode(db, view, token, "view");
    }
  } catch {
    return { ok: false, status: 500, error: "short-code-exhausted" };
  }
  if (!existing.short_code) {
    await db.prepare("UPDATE share_links SET short_code = ? WHERE token = ?").bind(download, token).run();
  }
  return { ok: true, download, view };
}

export async function insertShareLink(db: D1Database, row: ShareLink): Promise<void> {
  await db
    .prepare(
      `INSERT INTO share_links (${SHARE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.token,
      row.kind,
      row.target,
      row.password_hash,
      row.max_downloads,
      row.download_count,
      row.created_at,
      row.expires_at,
      row.revoked,
      row.short_code,
      row.fail_count,
      row.locked_until,
      row.allow_preview,
      row.allow_download,
    )
    .run();
}

export async function getShareFileCount(db: D1Database, token: string, fileId: string): Promise<number> {
  const row = await db
    .prepare("SELECT count FROM share_file_counts WHERE token = ? AND file_id = ?")
    .bind(token, fileId)
    .first<{ count: number }>();
  return Number(row?.count) || 0;
}

export async function incrementShareFileCount(db: D1Database, token: string, fileId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO share_file_counts (token, file_id, count) VALUES (?, ?, 1)
       ON CONFLICT(token, file_id) DO UPDATE SET count = count + 1`,
    )
    .bind(token, fileId)
    .run();
}

export async function incrementShareDownload(db: D1Database, token: string): Promise<void> {
  await db
    .prepare("UPDATE share_links SET download_count = download_count + 1 WHERE token = ?")
    .bind(token)
    .run();
}

export async function deleteShareLink(db: D1Database, token: string): Promise<boolean> {
  const existing = await getShareLink(db, token);
  if (!existing) return false;
  await db.prepare("DELETE FROM share_file_counts WHERE token = ?").bind(token).run();
  await db.prepare("DELETE FROM share_short_codes WHERE token = ?").bind(token).run();
  await db.prepare("DELETE FROM share_links WHERE token = ?").bind(token).run();
  return true;
}

function labelFor(kind: ShareKind, files: FileRow[]): string {
  if (kind === "file") return files[0]?.name || "";
  if (files.length === 1) return files[0]!.name;
  return files[0] ? `${files[0].name} +${files.length - 1}` : "";
}

export function shareLandingPath(
  link: Pick<ShareLink, "kind" | "token" | "allow_preview" | "allow_download">,
  file?: Pick<FileRow, "path" | "name"> | null,
): string {
  if (link.kind === "batch") return batchSharePaths(link.token).previewUrl;
  if (!file) return `/share/${link.token}`;
  if (shareAllowsPreview(link)) return fileLongPath(file, link.token, true);
  return fileLongPath(file, link.token);
}

/** Always the real download + preview paths (permissions only gate access, not URL shape). */
export function shareCopyPaths(
  link: Pick<ShareLink, "kind" | "token">,
  file?: Pick<FileRow, "path" | "name"> | null,
): { downloadUrl: string; viewUrl: string | null } {
  if (link.kind === "batch") {
    const batch = batchSharePaths(link.token);
    return { downloadUrl: batch.downloadUrl, viewUrl: batch.previewUrl };
  }
  if (!file) return { downloadUrl: `/share/${link.token}`, viewUrl: null };
  return {
    downloadUrl: fileLongPath(file, link.token),
    viewUrl: fileLongPath(file, link.token, true),
  };
}

export function toShareView(
  link: ShareLink,
  files: FileRow[],
  now = Date.now(),
  codes: ShareModeCodes = { download: null, view: null },
): ShareLinkView {
  const ids = targetIds(link);
  const status = shareStatus(link, now);
  const file = files[0];
  const allowPreview = shareAllowsPreview(link);
  const allowDownload = shareAllowsDownload(link);
  const longCopies = shareCopyPaths(link, file);
  const url = shareLandingPath(link, file);
  const downloadUrl = codes.download ? shortSharePath(codes.download) : longCopies.downloadUrl;
  const viewUrl = codes.view ? shortSharePath(codes.view) : longCopies.viewUrl;
  const shortUrl = codes.download
    ? shortSharePath(codes.download)
    : link.short_code
      ? shortSharePath(link.short_code)
      : null;
  return {
    token: link.token,
    kind: link.kind,
    target: link.target,
    target_ids: ids,
    target_label: labelFor(link.kind, files) || ids.join(", "),
    has_password: Boolean(link.password_hash),
    max_downloads: link.max_downloads,
    download_count: link.download_count,
    created_at: link.created_at,
    expires_at: link.expires_at,
    revoked: Boolean(link.revoked),
    short_code: link.short_code,
    download_short_code: codes.download,
    preview_short_code: codes.view,
    url,
    viewUrl,
    downloadUrl,
    shortUrl,
    status,
    allow_preview: allowPreview,
    allow_download: allowDownload,
  };
}

async function hydrate(db: D1Database, links: ShareLink[], now = Date.now()): Promise<ShareLinkView[]> {
  const ids = [...new Set(links.flatMap(targetIds))];
  const files = await getFilesByIds(db, ids);
  const byId = new Map(files.map((f) => [f.id, f]));
  const views: ShareLinkView[] = [];
  for (const link of links) {
    const ordered = targetIds(link)
      .map((id) => byId.get(id))
      .filter((row): row is FileRow => Boolean(row));
    let codes = await getShareModeCodes(db, link.token);
    if (!codes.download || !codes.view) {
      const ensured = await ensureShareModeCodes(db, link.token);
      if (ensured.ok) codes = { download: ensured.download, view: ensured.view };
    }
    views.push(toShareView(link, ordered, now, codes));
  }
  return views;
}

export async function listShareLinks(
  db: D1Database,
  opts: { q?: string; kind?: ShareKind; status?: ShareStatus; now?: number } = {},
): Promise<ShareLinkView[]> {
  const rows = await db
    .prepare(`SELECT ${SHARE_COLS} FROM share_links ORDER BY created_at DESC`)
    .all<ShareLink>();
  const links = (rows.results || []).map(normalizeShareLink);
  const now = opts.now ?? Date.now();
  let views = await hydrate(db, links, now);
  if (opts.kind) views = views.filter((v) => v.kind === opts.kind);
  if (opts.status) views = views.filter((v) => v.status === opts.status);
  const q = (opts.q || "").trim().toLowerCase();
  if (q) {
    views = views.filter((v) => {
      const hay =
        `${v.target_label} ${v.token} ${v.short_code || ""} ${v.download_short_code || ""} ${v.preview_short_code || ""} ${v.target}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return views;
}

export async function getShareView(db: D1Database, token: string, now = Date.now()): Promise<ShareLinkView | null> {
  const link = await getShareLink(db, token);
  if (!link) return null;
  const [view] = await hydrate(db, [link], now);
  return view ?? null;
}

async function findDefaultFileShare(db: D1Database, fileId: string, now: Date): Promise<ShareLink | null> {
  const rows = await db
    .prepare(
      `SELECT ${SHARE_COLS} FROM share_links
       WHERE kind = 'file' AND target = ? AND revoked = 0
         AND password_hash IS NULL AND max_downloads IS NULL
       ORDER BY created_at DESC`,
    )
    .bind(fileId)
    .all<ShareLink>();
  const iso = now.toISOString();
  for (const row of rows.results || []) {
    const link = normalizeShareLink(row);
    if (link.expires_at && link.expires_at <= iso) continue;
    if (shareStatus(link, now.getTime()) !== "active") continue;
    return link;
  }
  return null;
}

function parseExpires(body: CreateShareBody & PatchShareBody, fallback: string | null): { value: string | null; error?: string } {
  if (asBool(body.permanent)) return { value: null };
  if (asBool((body as PatchShareBody).expireNow)) return parseExpireInput({ expireNow: true });
  const parsed = parseExpireInput({
    expires: typeof body.expires === "string" ? body.expires : undefined,
    hours: body.hours == null || body.hours === "" ? undefined : Number(body.hours),
    days: body.days == null || body.days === "" ? undefined : Number(body.days),
  });
  if (parsed.error) return { value: null, error: parsed.error };
  if (
    body.expires != null ||
    body.hours != null ||
    body.days != null ||
    asBool(body.permanent)
  ) {
    return { value: parsed.value };
  }
  return { value: fallback };
}

export async function createShare(
  db: D1Database,
  body: CreateShareBody,
  now = new Date(),
): Promise<CreateShareResult> {
  if (!isShareKind(body.kind)) return { ok: false, status: 400, error: "need kind" };
  const parsed = parseBatchIds({ ids: body.ids });
  if (parsed.error) return { ok: false, status: 400, error: parsed.error };
  if (body.kind === "file" && parsed.ids.length !== 1) {
    return { ok: false, status: 400, error: "need one id" };
  }
  const password = optionalPassword(body.password);
  if (password === undefined) return { ok: false, status: 400, error: "invalid password" };
  const maxDownloads = asInt(body.max_downloads);
  if (maxDownloads === undefined) return { ok: false, status: 400, error: "invalid max_downloads" };
  if (maxDownloads != null && maxDownloads < 1) {
    return { ok: false, status: 400, error: "invalid max_downloads" };
  }

  const files = await getFilesByIds(db, parsed.ids);
  if (files.length !== parsed.ids.length) return { ok: false, status: 400, error: "files not found" };

  const allowDownload = "allow_download" in body ? (asBool(body.allow_download) ? 1 : 0) : 1;
  const allowPreview = "allow_preview" in body ? (asBool(body.allow_preview) ? 1 : 0) : 1;
  if (!allowDownload && !allowPreview) {
    return { ok: false, status: 400, error: "need download or preview" };
  }

  const reuseDefault =
    asBool(body.reuseDefault) &&
    body.kind === "file" &&
    !password &&
    maxDownloads == null &&
    body.expires == null &&
    body.hours == null &&
    body.days == null &&
    !asBool(body.permanent) &&
    allowDownload === 1 &&
    allowPreview === 1;

  if (reuseDefault) {
    const existing = await findDefaultFileShare(db, parsed.ids[0]!, now);
    if (existing && shareAllowsDownload(existing) && shareAllowsPreview(existing)) {
      const [view] = await hydrate(db, [existing], now.getTime());
      if (view) {
        return {
          ok: true,
          token: existing.token,
          kind: existing.kind,
          url: view.url,
          viewUrl: view.viewUrl,
          downloadUrl: view.downloadUrl,
          shortUrl: view.shortUrl,
          shortCode: view.download_short_code || view.short_code,
          count: 1,
          expiresAt: existing.expires_at,
          reused: true,
          hasPassword: false,
          allowDownload: true,
          allowPreview: true,
        };
      }
    }
  }

  const fallbackExpires = body.kind === "batch" ? shortestExpiry(files) : null;
  const expires = parseExpires(body, fallbackExpires);
  if (expires.error) return { ok: false, status: 400, error: expires.error };

  let downloadCode: string;
  let viewCode: string;
  try {
    downloadCode = await allocateShortCode(db);
    viewCode = await allocateShortCode(db);
  } catch {
    return { ok: false, status: 500, error: "short-code-exhausted" };
  }

  const token = generateShareToken();
  const passwordHash = password ? await hashSharePassword(password) : null;
  const row: ShareLink = {
    token,
    kind: body.kind,
    target: body.kind === "file" ? parsed.ids[0]! : JSON.stringify(parsed.ids),
    password_hash: passwordHash,
    max_downloads: maxDownloads,
    download_count: 0,
    created_at: now.toISOString(),
    expires_at: expires.value,
    revoked: 0,
    short_code: downloadCode,
    fail_count: 0,
    locked_until: null,
    allow_preview: allowPreview,
    allow_download: allowDownload,
  };
  await insertShareLink(db, row);
  await insertShareModeCode(db, downloadCode, token, "download");
  await insertShareModeCode(db, viewCode, token, "view");
  const [view] = await hydrate(db, [row], now.getTime());
  return {
    ok: true,
    token,
    kind: row.kind,
    url: view?.url || `/share/${token}`,
    viewUrl: view?.viewUrl ?? null,
    downloadUrl: view?.downloadUrl || (view?.url ?? `/share/${token}`),
    shortUrl: view?.shortUrl ?? shortSharePath(downloadCode),
    shortCode: downloadCode,
    count: files.length,
    expiresAt: row.expires_at,
    reused: false,
    hasPassword: Boolean(passwordHash),
    allowDownload: Boolean(allowDownload),
    allowPreview: Boolean(allowPreview),
  };
}

export type PatchShareBody = {
  password?: unknown;
  clear_password?: unknown;
  max_downloads?: unknown;
  expires?: unknown;
  hours?: unknown;
  days?: unknown;
  permanent?: unknown;
  expireNow?: unknown;
  revoked?: unknown;
  allow_download?: unknown;
  allow_preview?: unknown;
};

export async function patchShare(
  db: D1Database,
  token: string,
  body: PatchShareBody,
  now = new Date(),
): Promise<{ ok: true; link: ShareLinkView } | { ok: false; status: number; error: string }> {
  const existing = await getShareLink(db, token);
  if (!existing) return { ok: false, status: 404, error: "not found" };

  const sets: string[] = [];
  const binds: unknown[] = [];

  if (asBool(body.clear_password) || body.password === null) {
    sets.push("password_hash = ?");
    binds.push(null);
    sets.push("fail_count = ?");
    binds.push(0);
    sets.push("locked_until = ?");
    binds.push(null);
  } else if (body.password != null) {
    const password = optionalPassword(body.password);
    if (password === undefined || password === null) return { ok: false, status: 400, error: "invalid password" };
    sets.push("password_hash = ?");
    binds.push(await hashSharePassword(password));
    sets.push("fail_count = ?");
    binds.push(0);
    sets.push("locked_until = ?");
    binds.push(null);
  }

  if ("max_downloads" in body) {
    const maxDownloads = asInt(body.max_downloads);
    if (maxDownloads === undefined) return { ok: false, status: 400, error: "invalid max_downloads" };
    if (maxDownloads != null && maxDownloads < 1) {
      return { ok: false, status: 400, error: "invalid max_downloads" };
    }
    sets.push("max_downloads = ?");
    binds.push(maxDownloads);
  }

  if (
    body.permanent != null ||
    body.expireNow != null ||
    body.expires != null ||
    body.hours != null ||
    body.days != null
  ) {
    const expires = parseExpires(body, existing.expires_at);
    if (expires.error) return { ok: false, status: 400, error: expires.error };
    sets.push("expires_at = ?");
    binds.push(expires.value);
  }

  if (body.revoked != null) {
    sets.push("revoked = ?");
    binds.push(asBool(body.revoked) ? 1 : 0);
  }

  if ("allow_download" in body || "allow_preview" in body) {
    const nextDownload = "allow_download" in body ? (asBool(body.allow_download) ? 1 : 0) : existing.allow_download;
    const nextPreview = "allow_preview" in body ? (asBool(body.allow_preview) ? 1 : 0) : existing.allow_preview;
    if (!nextDownload && !nextPreview) {
      return { ok: false, status: 400, error: "need download or preview" };
    }
    if ("allow_download" in body) {
      sets.push("allow_download = ?");
      binds.push(nextDownload);
    }
    if ("allow_preview" in body) {
      sets.push("allow_preview = ?");
      binds.push(nextPreview);
    }
  }

  if (!sets.length) return { ok: false, status: 400, error: "need patch" };
  binds.push(token);
  await db
    .prepare(`UPDATE share_links SET ${sets.join(", ")} WHERE token = ?`)
    .bind(...binds)
    .run();
  const view = await getShareView(db, token, now.getTime());
  if (!view) return { ok: false, status: 404, error: "not found" };
  return { ok: true, link: view };
}

export async function assignShareShortCode(
  db: D1Database,
  token: string,
): Promise<
  | { ok: true; shortCode: string; shortUrl: string; downloadUrl: string; viewUrl: string }
  | { ok: false; status: number; error: string }
> {
  const ensured = await ensureShareModeCodes(db, token);
  if (!ensured.ok) return ensured;
  return {
    ok: true,
    shortCode: ensured.download,
    shortUrl: shortSharePath(ensured.download),
    downloadUrl: shortSharePath(ensured.download),
    viewUrl: shortSharePath(ensured.view),
  };
}

export type ShareGate =
  | { status: 404 }
  | { status: 410; reason: Exclude<ShareStatus, "active"> }
  | { status: 302; location: string }
  | { status: 200; link: ShareLink; countShare: boolean; countBatchFile: boolean };

export async function shareCookieUnlocked(
  link: ShareLink,
  cookieHeader: string | null | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!link.password_hash) return true;
  const raw = parseCookieHeader(cookieHeader)[shareCookieName(link.token)];
  if (!raw) return false;
  return verifyUnlockCookie(link.password_hash, link.token, raw, now);
}

export async function evaluateShareAccess(
  link: ShareLink | null,
  opts: { cookieHeader?: string | null; nextPath: string; now?: number },
): Promise<ShareGate> {
  if (!link) return { status: 404 };
  const now = opts.now ?? Date.now();
  const status = shareStatus(link, now);
  if (status !== "active") return { status: 410, reason: status };
  if (link.password_hash && !(await shareCookieUnlocked(link, opts.cookieHeader, now))) {
    return { status: 302, location: passwordPagePath(link.token, opts.nextPath) };
  }
  return { status: 200, link, countShare: link.kind === "file", countBatchFile: false };
}

export async function authorizeFileShare(
  db: D1Database,
  opts: {
    fileId: string;
    token: string | null;
    cookieHeader: string | null;
    nextPath: string;
    now?: number;
    view?: boolean;
    inline?: boolean;
    bundle?: boolean;
  },
): Promise<ShareGate> {
  const token = (opts.token || "").trim();
  if (!token) return { status: 404 };
  const link = await getShareLink(db, token);
  if (!link || !shareAllowsFile(link, opts.fileId)) return { status: 404 };
  const gate = await evaluateShareAccess(link, opts);
  if (gate.status !== 200) return gate;
  const wantsView = Boolean(opts.view);
  const wantsInline = Boolean(opts.inline);
  const wantsBundle = Boolean(opts.bundle);
  const wantsAttachment = !wantsView && !wantsInline;
  if ((wantsView || wantsInline) && !shareAllowsPreview(link)) return { status: 404 };
  if (wantsAttachment && !shareAllowsDownload(link)) return { status: 404 };
  if (wantsBundle && !shareAllowsDownload(link)) return { status: 404 };
  if (sharePackOnly(link) && (wantsView || wantsInline || (wantsAttachment && !wantsBundle))) {
    return { status: 404 };
  }
  if (link.kind === "batch") {
    if (link.max_downloads != null) {
      const n = await getShareFileCount(db, link.token, opts.fileId);
      if (n >= link.max_downloads) return { status: 410, reason: "exhausted" };
    }
    return { status: 200, link, countShare: false, countBatchFile: wantsAttachment };
  }
  return { status: 200, link, countShare: wantsAttachment, countBatchFile: false };
}

export async function longPathForShare(db: D1Database, link: ShareLink): Promise<string>;
export async function longPathForShare(
  db: D1Database,
  link: ShareLink,
  mode: ShareShortMode,
): Promise<string | null>;
export async function longPathForShare(
  db: D1Database,
  link: ShareLink,
  mode?: ShareShortMode | null,
): Promise<string | null> {
  if (link.kind === "batch") {
    const batch = batchSharePaths(link.token);
    if (mode === "download") return shareAllowsDownload(link) ? batch.downloadUrl : null;
    if (mode === "view") return shareAllowsPreview(link) ? batch.previewUrl : null;
    return batch.previewUrl;
  }
  const files = await getFilesByIds(db, [link.target]);
  const file = files[0] ?? null;
  if (mode === "download") {
    if (!shareAllowsDownload(link)) return null;
    if (!file) return `/share/${link.token}`;
    return fileLongPath(file, link.token, false);
  }
  if (mode === "view") {
    if (!shareAllowsPreview(link)) return null;
    if (!file) return `/share/${link.token}`;
    return fileLongPath(file, link.token, true);
  }
  return shareLandingPath(link, file);
}

export async function resolveShortShareRedirect(
  db: D1Database,
  code: string,
  now = Date.now(),
): Promise<
  | { status: 404 }
  | { status: 410; reason: Exclude<ShareStatus, "active"> }
  | { status: 302; location: string }
> {
  const trimmed = (code || "").trim();
  if (!isShortCode(trimmed)) return { status: 404 };
  const modeRow = await getShareShortByCode(db, trimmed);
  const link = modeRow ? await getShareLink(db, modeRow.token) : await getShareLinkByShortCode(db, trimmed);
  if (!link) return { status: 404 };
  const status = shareStatus(link, now);
  if (status !== "active") return { status: 410, reason: status };
  const location = modeRow
    ? await longPathForShare(db, link, modeRow.mode)
    : await longPathForShare(db, link);
  if (!location) return { status: 404 };
  return { status: 302, location };
}

export type VerifyShareResult =
  | { ok: true; setCookie: string; next: string }
  | { ok: false; status: number; error: string; lockedUntil?: string; minutes?: number };

export async function verifySharePasswordAttempt(
  db: D1Database,
  token: string,
  password: string,
  opts: { next?: string; secure: boolean; now?: Date },
): Promise<VerifyShareResult> {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const link = await getShareLink(db, token);
  if (!link) return { ok: false, status: 404, error: "not found" };
  const status = shareStatus(link, nowMs);
  if (status !== "active") return { ok: false, status: 410, error: status };
  const fallback = (await longPathForShare(db, link)) || `/share/${link.token}`;
  const next = safeShareNext(opts.next, fallback);

  if (!link.password_hash) {
    return { ok: true, setCookie: "", next };
  }

  if (isShareLocked(link.locked_until, nowMs)) {
    return {
      ok: false,
      status: 429,
      error: "locked",
      lockedUntil: link.locked_until || undefined,
    };
  }

  const good = await verifySharePassword(link.password_hash, password);
  if (!good) {
    const failCount = link.fail_count + 1;
    if (failCount >= SHARE_LOCK_AFTER) {
      const lockedUntil = lockUntilIso(nowMs);
      await db
        .prepare("UPDATE share_links SET fail_count = ?, locked_until = ? WHERE token = ?")
        .bind(0, lockedUntil, token)
        .run();
      return { ok: false, status: 429, error: "locked", lockedUntil };
    }
    await db
      .prepare("UPDATE share_links SET fail_count = ?, locked_until = ? WHERE token = ?")
      .bind(failCount, null, token)
      .run();
    return { ok: false, status: 401, error: "bad password" };
  }

  await db
    .prepare("UPDATE share_links SET fail_count = ?, locked_until = ? WHERE token = ?")
    .bind(0, null, token)
    .run();
  const value = await mintUnlockCookie(link.password_hash, token, nowMs);
  const setCookie = serializeShareCookie({ token, value, secure: opts.secure });
  return { ok: true, setCookie, next };
}
