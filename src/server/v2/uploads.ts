import type { FileDto } from "@/lib/v2-contracts";
import { DomainError, conflict, notFound } from "./errors";
import { assertFolder, cleanFileName, getFileDto } from "./files";

export const UPLOAD_PART_SIZE = 8 * 1024 * 1024;
export const MAX_UPLOAD_PART_SIZE = 10 * 1024 * 1024;
const SESSION_TTL_MS = 2 * 3600_000;

type UploadSession = {
  id: string;
  folder_id: string | null;
  name: string;
  mime: string | null;
  sha256: string;
  expected_size: number;
  storage_key: string;
  r2_upload_id: string | null;
  state: "prepared" | "uploading" | "completing" | "complete" | "aborted";
  expires_at: string | null;
  session_expires_at: string;
};

type BlobHit = { id: string; size: number };

async function ensureFileSlot(db: D1Database, folderId: string | null, name: string): Promise<void> {
  const row = folderId
    ? await db.prepare("SELECT id FROM files WHERE folder_id = ? AND name = ? COLLATE NOCASE AND deleted_at IS NULL").bind(folderId, name).first()
    : await db.prepare("SELECT id FROM files WHERE folder_id IS NULL AND name = ? COLLATE NOCASE AND deleted_at IS NULL").bind(name).first();
  if (row) conflict("file-exists", "name");
}

async function insertFileForBlob(
  db: D1Database,
  blobId: string,
  input: { folderId: string | null; name: string; mime: string | null; expiresAt: string | null },
): Promise<FileDto> {
  await ensureFileSlot(db, input.folderId, input.name);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db
      .prepare("INSERT INTO files (id, blob_id, folder_id, name, mime, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, blobId, input.folderId, input.name, input.mime, input.expiresAt, now, now)
      .run();
  } catch (error) {
    if (/UNIQUE/i.test(String(error))) conflict("file-exists", "name");
    throw error;
  }
  return getFileDto(db, id);
}

export async function prepareUpload(
  db: D1Database,
  r2: R2Bucket,
  input: { folderId: string | null; name: string; mime: string | null; size: number; sha256: string; expiresAt?: string | null },
): Promise<
  | { kind: "instant"; file: FileDto }
  | { kind: "single"; sessionId: string; partSize: number }
  | { kind: "multipart"; sessionId: string; partSize: number }
> {
  const name = cleanFileName(input.name);
  await assertFolder(db, input.folderId);
  await ensureFileSlot(db, input.folderId, name);
  const hit = await db
    .prepare("SELECT id, size FROM blobs WHERE sha256 = ? AND state = 'active'")
    .bind(input.sha256)
    .first<BlobHit>();
  if (hit) {
    if (Number(hit.size) !== input.size) throw new DomainError("hash-size-mismatch", 409, "sha256");
    return {
      kind: "instant",
      file: await insertFileForBlob(db, hit.id, {
        folderId: input.folderId,
        name,
        mime: input.mime,
        expiresAt: input.expiresAt ?? null,
      }),
    };
  }

  const id = crypto.randomUUID();
  const storageKey = `blobs/${crypto.randomUUID()}`;
  const now = new Date();
  const sessionExpiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  let uploadId: string | null = null;
  let state: UploadSession["state"] = "prepared";
  if (input.size > UPLOAD_PART_SIZE) {
    const upload = await r2.createMultipartUpload(storageKey, {
      httpMetadata: { contentType: input.mime || "application/octet-stream" },
      customMetadata: { sha256: input.sha256 },
    });
    uploadId = upload.uploadId;
    state = "uploading";
  }
  await db
    .prepare(`INSERT INTO upload_sessions (id, folder_id, name, mime, sha256, expected_size, storage_key, r2_upload_id, state, expires_at, created_at, updated_at, session_expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.folderId, name, input.mime, input.sha256, input.size, storageKey, uploadId, state, input.expiresAt ?? null, now.toISOString(), now.toISOString(), sessionExpiresAt)
    .run();
  return { kind: uploadId ? "multipart" : "single", sessionId: id, partSize: UPLOAD_PART_SIZE };
}

async function getSession(db: D1Database, id: string): Promise<UploadSession> {
  const row = await db.prepare("SELECT * FROM upload_sessions WHERE id = ?").bind(id).first<UploadSession>();
  if (!row) notFound("upload-session-not-found");
  if (new Date(row.session_expires_at).getTime() < Date.now()) throw new DomainError("upload-session-expired", 410);
  if (row.state === "aborted" || row.state === "complete") throw new DomainError("upload-session-closed", 409);
  return row;
}

async function finalizeUpload(db: D1Database, r2: R2Bucket, session: UploadSession, size: number): Promise<FileDto> {
  if (size !== Number(session.expected_size)) {
    await r2.delete(session.storage_key).catch(() => undefined);
    await db.prepare("UPDATE upload_sessions SET state = 'aborted', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), session.id).run();
    throw new DomainError("upload-size-mismatch", 409);
  }
  await ensureFileSlot(db, session.folder_id, session.name);
  const now = new Date().toISOString();
  const blobId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare("INSERT INTO blobs (id, storage_key, sha256, size, created_at) VALUES (?, ?, ?, ?, ?)").bind(blobId, session.storage_key, session.sha256, size, now),
      db.prepare("INSERT INTO files (id, blob_id, folder_id, name, mime, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(fileId, blobId, session.folder_id, session.name, session.mime, session.expires_at, now, now),
      db.prepare("UPDATE upload_sessions SET state = 'complete', updated_at = ? WHERE id = ?").bind(now, session.id),
    ]);
    return getFileDto(db, fileId);
  } catch (error) {
    const existing = await db.prepare("SELECT id, size FROM blobs WHERE sha256 = ? AND state = 'active'").bind(session.sha256).first<BlobHit>();
    if (!existing || Number(existing.size) !== size) throw error;
    await r2.delete(session.storage_key).catch(() => undefined);
    const file = await insertFileForBlob(db, existing.id, {
      folderId: session.folder_id,
      name: session.name,
      mime: session.mime,
      expiresAt: session.expires_at,
    });
    await db.prepare("UPDATE upload_sessions SET state = 'complete', updated_at = ? WHERE id = ?").bind(now, session.id).run();
    return file;
  }
}

export async function uploadSingle(db: D1Database, r2: R2Bucket, sessionId: string, request: Request): Promise<FileDto> {
  const session = await getSession(db, sessionId);
  if (session.r2_upload_id || session.expected_size > UPLOAD_PART_SIZE) throw new DomainError("multipart-required", 409);
  const length = Number(request.headers.get("content-length") || "0");
  if (length && length !== Number(session.expected_size)) throw new DomainError("upload-size-mismatch", 409);
  if (!request.body) throw new DomainError("empty-upload", 400);
  const body = await request.arrayBuffer();
  if (body.byteLength !== Number(session.expected_size)) throw new DomainError("upload-size-mismatch", 409);
  const object = await r2.put(session.storage_key, body, {
    httpMetadata: { contentType: session.mime || "application/octet-stream" },
    customMetadata: { sha256: session.sha256 },
    sha256: session.sha256,
  });
  return finalizeUpload(db, r2, session, object.size);
}

export async function uploadPart(
  db: D1Database,
  r2: R2Bucket,
  sessionId: string,
  partNumber: number,
  request: Request,
): Promise<R2UploadedPart> {
  const session = await getSession(db, sessionId);
  if (!session.r2_upload_id) throw new DomainError("single-upload-required", 409);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) throw new DomainError("invalid-part-number", 400);
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_UPLOAD_PART_SIZE) throw new DomainError("part-too-large", 413);
  if (!request.body) throw new DomainError("empty-upload", 400);
  return r2.resumeMultipartUpload(session.storage_key, session.r2_upload_id).uploadPart(partNumber, request.body);
}

export async function completeMultipart(
  db: D1Database,
  r2: R2Bucket,
  sessionId: string,
  parts: R2UploadedPart[],
): Promise<FileDto> {
  const session = await getSession(db, sessionId);
  if (!session.r2_upload_id) throw new DomainError("single-upload-required", 409);
  if (!parts.length) throw new DomainError("empty-parts", 400);
  await db.prepare("UPDATE upload_sessions SET state = 'completing', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), session.id).run();
  const object = await r2.resumeMultipartUpload(session.storage_key, session.r2_upload_id).complete(
    parts.slice().sort((a, b) => a.partNumber - b.partNumber),
  );
  return finalizeUpload(db, r2, session, object.size);
}

export async function abortUpload(db: D1Database, r2: R2Bucket, sessionId: string): Promise<void> {
  const session = await getSession(db, sessionId);
  if (session.r2_upload_id) {
    await r2.resumeMultipartUpload(session.storage_key, session.r2_upload_id).abort().catch(() => undefined);
  } else {
    await r2.delete(session.storage_key).catch(() => undefined);
  }
  await db.prepare("UPDATE upload_sessions SET state = 'aborted', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), session.id).run();
}

export async function cleanupUploadSessions(db: D1Database, r2: R2Bucket, now = new Date()): Promise<number> {
  const rows = await db
    .prepare("SELECT * FROM upload_sessions WHERE session_expires_at < ? AND state NOT IN ('complete', 'aborted') LIMIT 100")
    .bind(now.toISOString())
    .all<UploadSession>();
  let cleaned = 0;
  for (const session of rows.results || []) {
    try {
      if (session.r2_upload_id) await r2.resumeMultipartUpload(session.storage_key, session.r2_upload_id).abort();
      else await r2.delete(session.storage_key);
      await db.prepare("UPDATE upload_sessions SET state = 'aborted', updated_at = ? WHERE id = ?").bind(now.toISOString(), session.id).run();
      cleaned += 1;
    } catch (error) {
      console.error(JSON.stringify({ message: "upload cleanup deferred", sessionId: session.id, error: error instanceof Error ? error.message : String(error) }));
    }
  }
  await db.prepare("DELETE FROM upload_sessions WHERE state IN ('complete', 'aborted') AND updated_at < ?").bind(new Date(now.getTime() - 86400_000).toISOString()).run();
  return cleaned;
}
