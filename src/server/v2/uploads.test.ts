import { describe, expect, it, vi } from "vitest";
import { DomainError } from "./errors";
import {
  MAX_UPLOAD_PART_SIZE,
  UPLOAD_PART_SIZE,
  prepareUpload,
  readUploadBytes,
  uploadPart,
} from "./uploads";

type SessionRow = {
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

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    folder_id: null,
    name: "CalibrationRing.zip",
    mime: "application/zip",
    sha256: "a".repeat(64),
    expected_size: 18 * 1024 * 1024,
    storage_key: "blobs/abc",
    r2_upload_id: "mpu-1",
    state: "uploading",
    expires_at: null,
    session_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  };
}

function mockDb(first: unknown = null): D1Database {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        first: async () => first,
        run: async () => ({ success: true }),
        all: async () => ({ results: [] }),
      };
    },
    batch: async () => [],
  } as unknown as D1Database;
}

function mockR2(onUploadPart?: (partNumber: number, value: unknown) => Promise<R2UploadedPart> | R2UploadedPart): R2Bucket {
  return {
    createMultipartUpload: async () => ({ uploadId: "mpu-1" }),
    resumeMultipartUpload() {
      return {
        uploadPart: async (partNumber: number, value: unknown) => {
          if (onUploadPart) return onUploadPart(partNumber, value);
          if (typeof value === "object" && value && "getReader" in (value as object)) {
            throw new Error("Provided readable stream must have a known length (request/response body or a FixedLengthStream)");
          }
          return { partNumber, etag: `"etag-${partNumber}"` };
        },
        complete: async () => ({ size: 18 * 1024 * 1024 }),
        abort: async () => undefined,
      };
    },
    put: async (_key: string, value: ArrayBuffer) => ({ size: (value as ArrayBuffer).byteLength }),
    delete: async () => undefined,
  } as unknown as R2Bucket;
}

function fakeRequest(init: { length?: number; bytes?: ArrayBuffer }): Request {
  return {
    headers: new Headers(init.length != null ? { "content-length": String(init.length) } : {}),
    arrayBuffer: async () => init.bytes ?? new ArrayBuffer(0),
  } as unknown as Request;
}

describe("large zip uploads", () => {
  it("treats an 18 MB CalibrationRing.zip as multipart with 8 MiB parts", async () => {
    const size = 18 * 1024 * 1024;
    expect(size).toBeGreaterThan(UPLOAD_PART_SIZE);
    expect(Math.ceil(size / UPLOAD_PART_SIZE)).toBe(3);
    const result = await prepareUpload(mockDb(), mockR2(), {
      folderId: null,
      name: "CalibrationRing.zip",
      mime: "application/zip",
      size,
      sha256: "a".repeat(64),
    });
    expect(result).toMatchObject({ kind: "multipart", partSize: UPLOAD_PART_SIZE });
  });

  it("buffers each part into an ArrayBuffer before calling R2", async () => {
    const received: unknown[] = [];
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const uploaded = await uploadPart(
      mockDb(session()),
      mockR2((partNumber, value) => {
        received.push(value);
        return { partNumber, etag: "abc123" };
      }),
      session().id,
      1,
      fakeRequest({ length: 4, bytes }),
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toBeInstanceOf(ArrayBuffer);
    expect((received[0] as ArrayBuffer).byteLength).toBe(4);
    expect(uploaded).toEqual({ partNumber: 1, etag: "abc123" });
  });

  it("maps R2 known-length stream errors to a domain error instead of internal-error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      uploadPart(
        mockDb(session()),
        mockR2(() => {
          throw new Error("Provided readable stream must have a known length (request/response body or a FixedLengthStream)");
        }),
        session().id,
        1,
        fakeRequest({ bytes: new Uint8Array([9, 9]).buffer }),
      ),
    ).rejects.toMatchObject({ code: "upload-body-unreadable", status: 400 });
  });

  it("rejects parts larger than the Worker-safe cap", async () => {
    await expect(
      uploadPart(mockDb(session()), mockR2(), session().id, 1, fakeRequest({ length: MAX_UPLOAD_PART_SIZE + 1 })),
    ).rejects.toMatchObject({ code: "part-too-large", status: 413 });
  });

  it("rejects empty part bodies", async () => {
    await expect(uploadPart(mockDb(session()), mockR2(), session().id, 1, fakeRequest({ bytes: new ArrayBuffer(0) }))).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(uploadPart(mockDb(session()), mockR2(), session().id, 1, fakeRequest({ bytes: new ArrayBuffer(0) }))).rejects.toMatchObject({
      code: "empty-upload",
    });
  });

  it("turns a locked request body into empty-upload", async () => {
    const request = {
      headers: new Headers(),
      arrayBuffer: async () => {
        throw new TypeError("Failed to execute 'arrayBuffer' on 'Request': body is already used");
      },
    } as unknown as Request;
    await expect(readUploadBytes(request)).rejects.toMatchObject({ code: "empty-upload" });
  });
});
