import { describe, expect, it } from "vitest";
import {
  MAX_BATCH_IDS,
  batchSharePaths,
  createBatch,
  deleteExpiredBatches,
  generateBatchToken,
  getBatch,
  handleCreateBatch,
  parseBatchIds,
  parseFileIdsJson,
  resolveBatchPage,
  shortestExpiry,
} from "./batch";
import type { FileRow } from "./types";

type BatchRow = {
  token: string;
  file_ids: string;
  created_at: string;
  expires_at: string | null;
};

function file(partial: Partial<FileRow> & Pick<FileRow, "id" | "name">): FileRow {
  return {
    path: "",
    size: 12,
    mime: "text/plain",
    expires: null,
    download_count: 0,
    created_at: "2026-08-16T00:00:00.000Z",
    tags: "",
    deleted_at: null,
    starred: 0,
    sha256: null,
    ...partial,
  };
}

function memoryDrive(init?: { files?: FileRow[]; batches?: BatchRow[] }): D1Database {
  const files = new Map((init?.files ?? []).map((row) => [row.id, { ...row }]));
  const shares = new Map(
    (init?.batches ?? []).map((row) => [
      row.token,
      { token: row.token, target: row.file_ids, created_at: row.created_at, expires_at: row.expires_at, kind: "batch" },
    ]),
  );
  const legacyBatches = new Map((init?.batches ?? []).map((row) => [row.token, { ...row }]));

  const api = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (normalized.includes("FROM share_links") && normalized.includes("WHERE token")) {
                const row = shares.get(String(args[0]));
                if (!row) return null;
                if (normalized.includes("kind = 'batch'") && row.kind !== "batch") return null;
                return row as T;
              }
              if (normalized.includes("FROM batch_links") && normalized.includes("WHERE token")) {
                return (legacyBatches.get(String(args[0])) ?? null) as T;
              }
              return null;
            },
            async all<T>() {
              if (normalized.includes("FROM files") && normalized.includes("id IN")) {
                const results = args
                  .map((id) => files.get(String(id)))
                  .filter((row): row is FileRow => Boolean(row));
                return { results: results as T[] };
              }
              if (normalized.includes("FROM batch_links") && normalized.includes("expires_at IS NOT NULL")) {
                const cutoff = String(args[0]);
                const results = [...legacyBatches.values()].filter(
                  (row) => row.expires_at != null && row.expires_at < cutoff,
                );
                return { results: results as T[] };
              }
              return { results: [] as T[] };
            },
            async run() {
              if (normalized.startsWith("INSERT INTO share_links")) {
                shares.set(String(args[0]), {
                  token: String(args[0]),
                  target: String(args[1]),
                  created_at: String(args[2]),
                  expires_at: args[3] == null ? null : String(args[3]),
                  kind: "batch",
                });
              } else if (normalized.startsWith("INSERT INTO batch_links")) {
                legacyBatches.set(String(args[0]), {
                  token: String(args[0]),
                  file_ids: String(args[1]),
                  created_at: String(args[2]),
                  expires_at: args[3] == null ? null : String(args[3]),
                });
              } else if (normalized.startsWith("DELETE FROM batch_links")) {
                const cutoff = String(args[0]);
                for (const [token, row] of legacyBatches) {
                  if (row.expires_at != null && row.expires_at < cutoff) {
                    legacyBatches.delete(token);
                  }
                }
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
  return api as unknown as D1Database;
}

describe("generateBatchToken", () => {
  it("returns unique base64url 32-byte tokens", () => {
    const tokens = new Set(Array.from({ length: 40 }, () => generateBatchToken()));
    expect(tokens.size).toBe(40);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBe(43);
    }
  });
});

describe("parseBatchIds", () => {
  it("rejects empty / non-array / blank ids", () => {
    expect(parseBatchIds(null).error).toBe("need ids");
    expect(parseBatchIds({}).error).toBe("need ids");
    expect(parseBatchIds({ ids: [] }).error).toBe("need ids");
    expect(parseBatchIds({ ids: ["  ", ""] }).error).toBe("need ids");
  });

  it("dedupes and caps at 100", () => {
    expect(parseBatchIds({ ids: ["a", "a", " b "] }).ids).toEqual(["a", "b"]);
    const tooMany = Array.from({ length: MAX_BATCH_IDS + 1 }, (_, i) => `id-${i}`);
    expect(parseBatchIds({ ids: tooMany }).error).toBe("too many ids");
  });
});

describe("shortestExpiry", () => {
  it("is null when no file expires (permanent)", () => {
    expect(shortestExpiry([{ expires: null }, { expires: null }])).toBeNull();
  });

  it("takes the earliest expiry among files", () => {
    expect(
      shortestExpiry([
        { expires: "2026-08-20T00:00:00.000Z" },
        { expires: null },
        { expires: "2026-08-18T00:00:00.000Z" },
      ]),
    ).toBe("2026-08-18T00:00:00.000Z");
  });
});

describe("createBatch / getBatch", () => {
  const now = new Date("2026-08-16T12:00:00.000Z");

  it("creates a readable batch with permanent expiry when files never expire", async () => {
    const db = memoryDrive({
      files: [file({ id: "1", name: "a.txt" }), file({ id: "2", name: "b.txt" })],
    });
    const created = await createBatch(db, ["1", "2"], now);
    expect("token" in created).toBe(true);
    if ("error" in created) throw new Error(created.error);
    expect(created.count).toBe(2);
    expect(created.expiresAt).toBeNull();
    const row = await getBatch(db, created.token);
    expect(row?.file_ids).toBe(JSON.stringify(["1", "2"]));
    expect(row?.expires_at).toBeNull();
    expect(parseFileIdsJson(row!.file_ids)).toEqual(["1", "2"]);
  });

  it("stores the shortest file expiry", async () => {
    const db = memoryDrive({
      files: [
        file({ id: "1", name: "a.txt", expires: "2026-09-01T00:00:00.000Z" }),
        file({ id: "2", name: "b.txt", expires: "2026-08-20T00:00:00.000Z" }),
      ],
    });
    const created = await createBatch(db, ["1", "2"], now);
    if ("error" in created) throw new Error(created.error);
    expect(created.expiresAt).toBe("2026-08-20T00:00:00.000Z");
  });

  it("rejects empty ids and missing files", async () => {
    const db = memoryDrive({
      files: [
        file({ id: "1", name: "a.txt" }),
        file({ id: "gone", name: "gone.txt", deleted_at: "2026-08-16T00:00:00.000Z" }),
      ],
    });
    expect(await createBatch(db, [], now)).toEqual({ error: "need ids", status: 400 });
    expect(await createBatch(db, ["1", "missing"], now)).toEqual({ error: "files not found", status: 400 });
    expect(await createBatch(db, ["gone"], now)).toEqual({ error: "files not found", status: 400 });
  });

  it("getBatch returns null for an unknown token", async () => {
    const db = memoryDrive();
    expect(await getBatch(db, "nope")).toBeNull();
    expect(await getBatch(db, "")).toBeNull();
  });
});

describe("handleCreateBatch", () => {
  const now = new Date("2026-08-16T12:00:00.000Z");

  it("returns preview and download paths", async () => {
    const db = memoryDrive({ files: [file({ id: "1", name: "a.txt" })] });
    const result = await handleCreateBatch(db, { ids: ["1"] }, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count).toBe(1);
    expect(result.expiresAt).toBeNull();
    expect(result.previewUrl).toMatch(/^\/dl\/batch\/[A-Za-z0-9_-]+$/);
    expect(result.downloadUrl).toBe(`${result.previewUrl}?mode=download`);
    expect(result.downloadUrl).toBe(batchSharePaths(result.previewUrl.slice("/dl/batch/".length)).downloadUrl);
  });

  it("rejects invalid bodies", async () => {
    const db = memoryDrive();
    expect(await handleCreateBatch(db, { ids: [] }, now)).toEqual({
      ok: false,
      status: 400,
      error: "need ids",
    });
  });
});

describe("resolveBatchPage", () => {
  it("404s unknown tokens and 410s expired batches", async () => {
    const db = memoryDrive({
      files: [file({ id: "1", name: "a.txt" })],
      batches: [
        {
          token: "expired",
          file_ids: JSON.stringify(["1"]),
          created_at: "2026-08-01T00:00:00.000Z",
          expires_at: "2026-08-02T00:00:00.000Z",
        },
      ],
    });
    expect(await resolveBatchPage(db, "missing")).toEqual({ status: 404 });
    expect(await resolveBatchPage(db, "", Date.parse("2026-08-16T00:00:00.000Z"))).toEqual({
      status: 404,
    });
    expect(await resolveBatchPage(db, "expired", Date.parse("2026-08-16T00:00:00.000Z"))).toEqual({
      status: 410,
    });
  });

  it("skips deleted files when rendering a live batch", async () => {
    const db = memoryDrive({
      files: [
        file({ id: "keep", name: "keep.txt" }),
        file({ id: "gone", name: "gone.txt", deleted_at: "2026-08-16T00:00:00.000Z" }),
      ],
      batches: [
        {
          token: "live",
          file_ids: JSON.stringify(["keep", "gone"]),
          created_at: "2026-08-16T00:00:00.000Z",
          expires_at: null,
        },
      ],
    });
    const page = await resolveBatchPage(db, "live");
    expect(page.status).toBe(200);
    if (page.status !== 200) return;
    expect(page.files.map((f) => f.id)).toEqual(["keep"]);
  });
});

describe("deleteExpiredBatches", () => {
  it("only deletes leftover batch_links rows, not share_links", async () => {
    const db = memoryDrive({
      batches: [
        {
          token: "perm",
          file_ids: "[]",
          created_at: "2026-08-01T00:00:00.000Z",
          expires_at: null,
        },
        {
          token: "old",
          file_ids: "[]",
          created_at: "2026-08-01T00:00:00.000Z",
          expires_at: "2026-08-10T00:00:00.000Z",
        },
        {
          token: "future",
          file_ids: "[]",
          created_at: "2026-08-01T00:00:00.000Z",
          expires_at: "2026-09-01T00:00:00.000Z",
        },
      ],
    });
    const n = await deleteExpiredBatches(db, new Date("2026-08-16T00:00:00.000Z"));
    expect(n).toBe(1);
    expect(await getBatch(db, "perm")).not.toBeNull();
    expect(await getBatch(db, "future")).not.toBeNull();
    expect(await getBatch(db, "old")).not.toBeNull();
  });
});
