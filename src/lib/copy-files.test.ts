import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileRow, FolderRow } from "./types";

const getDB = vi.fn();
const copyObject = vi.fn();
const r2Delete = vi.fn();

vi.mock("@/lib/cloudflare", () => ({
  getDB: () => getDB(),
  getR2: async () => ({ delete: r2Delete }),
}));

vi.mock("@/lib/r2-copy", () => ({
  copyObject: (...args: unknown[]) => copyObject(...args),
}));

import { copyFiles } from "./store";

const HASH = "a".repeat(64);

function file(partial: Partial<FileRow> & Pick<FileRow, "id" | "name">): FileRow {
  return {
    path: "",
    size: 12,
    mime: "text/plain",
    expires: null,
    download_count: 7,
    created_at: "2026-08-01T00:00:00.000Z",
    tags: "合同",
    deleted_at: null,
    starred: 1,
    sha256: HASH,
    ...partial,
  };
}

function memoryDb(init: { files: FileRow[]; folders?: FolderRow[] }) {
  const files = init.files.map((row) => ({ ...row }));
  const folders = (init.folders ?? []).map((row) => ({ ...row }));
  return {
    files,
    db: {
      prepare(sql: string) {
        const n = sql.replace(/\s+/g, " ").trim();
        const exec = (args: unknown[]) => ({
          async first<T>() {
            if (n.includes("FROM files WHERE id = ?")) {
              return (files.find((row) => row.id === String(args[0])) ?? null) as T;
            }
            if (n.includes("SELECT id FROM files WHERE path = ? AND name = ? AND deleted_at IS NULL")) {
              const row = files.find(
                (f) => f.path === String(args[0]) && f.name === String(args[1]) && !f.deleted_at,
              );
              return (row ? { id: row.id } : null) as T;
            }
            return null;
          },
          async all<T>() {
            if (n.includes("FROM folders")) {
              return { results: folders as T[] };
            }
            return { results: [] as T[] };
          },
          async run() {
            if (n.startsWith("INSERT INTO files")) {
              const next: FileRow = {
                id: String(args[0]),
                name: String(args[1]),
                path: String(args[2]),
                size: Number(args[3]),
                mime: args[4] == null ? null : String(args[4]),
                expires: args[5] == null ? null : String(args[5]),
                download_count: Number(args[6]),
                created_at: String(args[7]),
                tags: String(args[8] ?? ""),
                deleted_at: args[9] == null ? null : String(args[9]),
                starred: Number(args[10]),
                sha256: args[11] == null ? null : String(args[11]),
              };
              if (files.some((f) => f.path === next.path && f.name === next.name && !f.deleted_at)) {
                throw new Error("UNIQUE constraint failed: idx_files_alive_path_name");
              }
              files.push(next);
            }
            return { success: true };
          },
        });
        return {
          bind(...args: unknown[]) {
            return exec(args);
          },
          ...exec([]),
        };
      },
    } as unknown as D1Database,
  };
}

describe("copyFiles", () => {
  beforeEach(() => {
    getDB.mockReset();
    copyObject.mockReset();
    r2Delete.mockReset();
    copyObject.mockResolvedValue({ ok: true, skipped: false });
  });

  it("creates a new D1 row and streams R2 to the destination key", async () => {
    const mem = memoryDb({
      files: [file({ id: "src", name: "a.txt", path: "", download_count: 9, starred: 1 })],
      folders: [{ id: "f1", name: "docs", parent_id: "", created_at: "2026-08-01T00:00:00.000Z" }],
    });
    getDB.mockResolvedValue(mem.db);
    const result = await copyFiles(["src"], "docs");
    expect(result.copied).toBe(1);
    expect(result.results[0]?.ok).toBe(true);
    expect(copyObject).toHaveBeenCalledWith("a.txt", "docs/a.txt");
    const clone = mem.files.find((row) => row.id === result.results[0]?.newId);
    const original = mem.files.find((row) => row.id === "src");
    expect(original?.path).toBe("");
    expect(clone).toMatchObject({
      name: "a.txt",
      path: "docs",
      size: 12,
      mime: "text/plain",
      tags: "合同",
      download_count: 0,
      starred: 0,
      sha256: HASH,
    });
    expect(clone?.id).not.toBe("src");
  });

  it("does not copy into the source folder", async () => {
    const mem = memoryDb({
      files: [file({ id: "src", name: "a.txt", path: "docs" })],
      folders: [{ id: "f1", name: "docs", parent_id: "", created_at: "2026-08-01T00:00:00.000Z" }],
    });
    getDB.mockResolvedValue(mem.db);
    const result = await copyFiles(["src"], "docs");
    expect(result).toEqual({
      copied: 0,
      results: [{ id: "src", ok: false, error: "same-path" }],
    });
    expect(copyObject).not.toHaveBeenCalled();
  });

  it("reports file-exists when the destination already has that name", async () => {
    const mem = memoryDb({
      files: [
        file({ id: "src", name: "a.txt", path: "" }),
        file({ id: "hit", name: "a.txt", path: "docs" }),
      ],
      folders: [{ id: "f1", name: "docs", parent_id: "", created_at: "2026-08-01T00:00:00.000Z" }],
    });
    getDB.mockResolvedValue(mem.db);
    const result = await copyFiles(["src"], "docs");
    expect(result.results[0]).toEqual({ id: "src", ok: false, error: "file-exists" });
    expect(copyObject).not.toHaveBeenCalled();
  });

  it("copies what it can when a batch is mixed", async () => {
    const mem = memoryDb({
      files: [
        file({ id: "ok", name: "keep.txt", path: "" }),
        file({ id: "clash", name: "dup.txt", path: "" }),
        file({ id: "existing", name: "dup.txt", path: "docs" }),
      ],
      folders: [{ id: "f1", name: "docs", parent_id: "", created_at: "2026-08-01T00:00:00.000Z" }],
    });
    getDB.mockResolvedValue(mem.db);
    const result = await copyFiles(["ok", "clash", "missing"], "docs");
    expect(result.copied).toBe(1);
    expect(result.results.map((r) => r.error || "ok")).toEqual(["ok", "file-exists", "not-found"]);
    expect(copyObject).toHaveBeenCalledTimes(1);
  });

  it("skips soft-deleted sources", async () => {
    const mem = memoryDb({
      files: [file({ id: "gone", name: "a.txt", path: "", deleted_at: "2026-08-01T00:00:00.000Z" })],
      folders: [{ id: "f1", name: "docs", parent_id: "", created_at: "2026-08-01T00:00:00.000Z" }],
    });
    getDB.mockResolvedValue(mem.db);
    const result = await copyFiles(["gone"], "docs");
    expect(result.results[0]?.error).toBe("not-found");
    expect(copyObject).not.toHaveBeenCalled();
  });

  it("throws folder-not-found like move", async () => {
    const mem = memoryDb({ files: [file({ id: "src", name: "a.txt" })] });
    getDB.mockResolvedValue(mem.db);
    await expect(copyFiles(["src"], "ghost")).rejects.toThrow("folder-not-found");
  });

  it("does not insert D1 when R2 miss", async () => {
    const mem = memoryDb({
      files: [file({ id: "src", name: "a.txt" })],
      folders: [{ id: "f1", name: "docs", parent_id: "", created_at: "2026-08-01T00:00:00.000Z" }],
    });
    getDB.mockResolvedValue(mem.db);
    copyObject.mockResolvedValue({ ok: false, error: "miss" });
    const result = await copyFiles(["src"], "docs");
    expect(result.results[0]).toEqual({ id: "src", ok: false, error: "miss" });
    expect(mem.files).toHaveLength(1);
  });
});
