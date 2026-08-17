import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SHARE_LOCK_AFTER } from "./share-password";
import {
  assignShareShortCode,
  authorizeFileShare,
  createShare,
  deleteShareLink,
  evaluateShareAccess,
  getShareLink,
  incrementShareDownload,
  incrementShareFileCount,
  listShareLinks,
  patchShare,
  shareAllowsDownload,
  shareAllowsFile,
  shareCopyPaths,
  shareStatus,
  toShareView,
  verifySharePasswordAttempt,
  type ShareLink,
} from "./share";
import type { FileRow } from "./types";

type ShareRow = Omit<ShareLink, "allow_preview" | "allow_download"> & {
  allow_preview: number | null;
  allow_download: number | null;
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

function memoryShare(init?: { files?: FileRow[]; links?: ShareRow[] }): D1Database {
  const files = new Map((init?.files ?? []).map((row) => [row.id, { ...row }]));
  const links = new Map(
    (init?.links ?? []).map((row) => [
      row.token,
      { ...row, allow_preview: row.allow_preview ?? 1, allow_download: row.allow_download === undefined ? 1 : row.allow_download },
    ]),
  );
  const fileCounts = new Map<string, number>();

  function countKey(token: string, fileId: string) {
    return `${token}\t${fileId}`;
  }

  function applyUpdate(sql: string, args: unknown[]) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.includes("download_count = download_count + 1")) {
      const row = links.get(String(args[0]));
      if (row) row.download_count += 1;
      return;
    }
    const token = String(args[args.length - 1]);
    const row = links.get(token);
    if (!row) return;
    const setPart = normalized.replace(/^UPDATE share_links SET /i, "").replace(/ WHERE token = \?$/i, "");
    const cols = setPart.split(",").map((part) => part.trim().split("=")[0]!.trim());
    cols.forEach((col, i) => {
      const value = args[i] as never;
      (row as unknown as Record<string, unknown>)[col] = value ?? null;
    });
  }

  const api = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (normalized.includes("FROM share_file_counts")) {
                const n = fileCounts.get(countKey(String(args[0]), String(args[1])));
                if (n == null) return null;
                return { count: n } as T;
              }
              if (normalized.includes("FROM share_links") && normalized.includes("WHERE token")) {
                const row = links.get(String(args[0]));
                if (!row) return null;
                if (normalized.includes("kind = 'batch'") && row.kind !== "batch") return null;
                if (normalized.includes("SELECT token, target")) {
                  return { token: row.token, target: row.target, created_at: row.created_at, expires_at: row.expires_at } as T;
                }
                return row as T;
              }
              if (normalized.includes("FROM share_links") && normalized.includes("WHERE short_code")) {
                const hit = [...links.values()].find((r) => r.short_code === String(args[0]));
                return (hit ?? null) as T;
              }
              return null;
            },
            async all<T>() {
              if (normalized.includes("FROM files") && normalized.includes("id IN")) {
                const results = args
                  .map((id) => files.get(String(id)))
                  .filter((row): row is FileRow => Boolean(row) && !row!.deleted_at);
                return { results: results as T[] };
              }
              if (normalized.includes("FROM share_links") && normalized.includes("kind = 'file' AND target")) {
                const results = [...links.values()].filter(
                  (row) => row.kind === "file" && row.target === String(args[0]) && !row.revoked,
                );
                results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
                return { results: results as T[] };
              }
              if (normalized.includes("FROM share_links") && normalized.includes("ORDER BY created_at DESC")) {
                const results = [...links.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
                return { results: results as T[] };
              }
              return { results: [] as T[] };
            },
            async run() {
              if (normalized.startsWith("INSERT INTO share_file_counts")) {
                const key = countKey(String(args[0]), String(args[1]));
                fileCounts.set(key, (fileCounts.get(key) ?? 0) + 1);
              } else if (normalized.startsWith("DELETE FROM share_file_counts")) {
                const token = String(args[0]);
                for (const key of [...fileCounts.keys()]) {
                  if (key.startsWith(`${token}\t`)) fileCounts.delete(key);
                }
              } else if (normalized.startsWith("INSERT INTO share_links")) {
                const token = String(args[0]);
                const kind = String(args[1]) as ShareRow["kind"];
                links.set(token, {
                  token,
                  kind,
                  target: String(args[2]),
                  password_hash: args[3] == null ? null : String(args[3]),
                  max_downloads: args[4] == null ? null : Number(args[4]),
                  download_count: Number(args[5] ?? 0),
                  created_at: String(args[6]),
                  expires_at: args[7] == null ? null : String(args[7]),
                  revoked: Number(args[8] ?? 0),
                  short_code: args[9] == null ? null : String(args[9]),
                  fail_count: Number(args[10] ?? 0),
                  locked_until: args[11] == null ? null : String(args[11]),
                  allow_preview: args[12] == null ? 1 : Number(args[12]) ? 1 : 0,
                  allow_download: args[13] == null ? 1 : Number(args[13]) ? 1 : 0,
                });
              } else if (normalized.startsWith("UPDATE share_links")) {
                applyUpdate(sql, args);
              } else if (normalized.startsWith("DELETE FROM share_links")) {
                links.delete(String(args[0]));
              }
              return { success: true };
            },
          };
        },
        async all<T>() {
          if (normalized.includes("FROM share_links") && normalized.includes("ORDER BY created_at DESC")) {
            const results = [...links.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
            return { results: results as T[] };
          }
          return { results: [] as T[] };
        },
      };
    },
  };
  return api as unknown as D1Database;
}

describe("0014 share_links migration", () => {
  it("creates share_links and copies batch_links", () => {
    const sql = readFileSync(path.join(process.cwd(), "migrations/0014_share_links.sql"), "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS share_links");
    expect(sql).toContain("INSERT OR IGNORE INTO share_links");
    expect(sql).toContain("FROM batch_links");
    expect(sql).toContain("kind");
    expect(sql).toContain("short_code");
    expect(sql).toContain("password_hash");
    expect(sql).toContain("fail_count");
    expect(sql).toContain("schema_version', '14'");
  });
});

describe("0015 share_file_counts migration", () => {
  it("adds per-file counters and allow_preview", () => {
    const sql = readFileSync(path.join(process.cwd(), "migrations/0015_share_file_counts.sql"), "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS share_file_counts");
    expect(sql).toContain("PRIMARY KEY (token, file_id)");
    expect(sql).toContain("ALTER TABLE share_links ADD COLUMN allow_preview");
    expect(sql).toContain("schema_version', '15'");
  });
});

describe("0016 share_links allow_download", () => {
  it("adds allow_download and drops copy_view_link from the default toolbar", () => {
    const sql = readFileSync(path.join(process.cwd(), "migrations/0016_share_allow_download.sql"), "utf8");
    expect(sql).toContain("ALTER TABLE share_links ADD COLUMN allow_download");
    expect(sql).toContain("schema_version', '16'");
    expect(sql).toContain('["download","preview","share","expire","delete"]');
  });
});

describe("createShare / multi-link", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");

  it("creates independent file links with different permissions", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt", path: "docs" })] });
    const open = await createShare(db, { kind: "file", ids: ["1"] }, now);
    const locked = await createShare(db, { kind: "file", ids: ["1"], password: "secret" }, now);
    const limited = await createShare(db, { kind: "file", ids: ["1"], max_downloads: 2, hours: 24 }, now);
    expect(open.ok && locked.ok && limited.ok).toBe(true);
    if (!open.ok || !locked.ok || !limited.ok) return;
    expect(open.token).not.toBe(locked.token);
    expect(locked.hasPassword).toBe(true);
    expect(open.hasPassword).toBe(false);
    expect(limited.url).toContain("/view?t=");
    expect(limited.downloadUrl).toContain("/dl/docs/a.txt?t=");
    expect(open.viewUrl).toContain("/view?t=");
    const listed = await listShareLinks(db);
    expect(listed).toHaveLength(3);
    expect(new Set(listed.map((l) => l.token)).size).toBe(3);
  });

  it("reuses a default open file link when asked", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const first = await createShare(db, { kind: "file", ids: ["1"] }, now);
    const again = await createShare(db, { kind: "file", ids: ["1"], reuseDefault: true }, now);
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.reused).toBe(true);
    expect(again.token).toBe(first.token);
  });

  it("does not reuse when password or limits differ", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const first = await createShare(db, { kind: "file", ids: ["1"] }, now);
    const second = await createShare(db, { kind: "file", ids: ["1"], password: "x", reuseDefault: true }, now);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.reused).toBe(false);
    expect(second.token).not.toBe(first.token);
  });

  it("creates batch links and optional short codes", async () => {
    const db = memoryShare({
      files: [file({ id: "1", name: "a.txt" }), file({ id: "2", name: "b.txt" })],
    });
    const created = await createShare(db, { kind: "batch", ids: ["1", "2"], short: true }, now);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.url).toMatch(/^\/dl\/batch\//);
    expect(created.downloadUrl).toContain("mode=download");
    expect(created.shortCode).toMatch(/^[0-9A-Za-z]{6,8}$/);
    expect(created.shortUrl).toBe(`/s/${created.shortCode}`);
  });
});

describe("share access / password / short", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  it("404s missing token and mismatched file", async () => {
    const db = memoryShare({
      files: [file({ id: "1", name: "a.txt" }), file({ id: "2", name: "b.txt" })],
    });
    const created = await createShare(db, { kind: "file", ids: ["1"] }, now);
    if (!created.ok) throw new Error("create");
    expect(await authorizeFileShare(db, { fileId: "1", token: null, cookieHeader: null, nextPath: "/dl/a.txt" })).toEqual({
      status: 404,
    });
    expect(await authorizeFileShare(db, { fileId: "2", token: created.token, cookieHeader: null, nextPath: "/dl/b.txt" })).toEqual({
      status: 404,
    });
    const ok = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=x",
    });
    expect(ok.status).toBe(200);
  });

  it("410s revoked, expired, and exhausted links independently", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const revoked = await createShare(db, { kind: "file", ids: ["1"] }, now);
    const expired = await createShare(db, { kind: "file", ids: ["1"], expires: "2026-08-01T00:00:00.000Z" }, now);
    const limited = await createShare(db, { kind: "file", ids: ["1"], max_downloads: 1 }, now);
    if (!revoked.ok || !expired.ok || !limited.ok) throw new Error("create");
    await patchShare(db, revoked.token, { revoked: true }, now);
    await incrementShareDownload(db, limited.token);
    const r1 = await authorizeFileShare(db, {
      fileId: "1",
      token: revoked.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt",
      now: now.getTime(),
    });
    const r2 = await authorizeFileShare(db, {
      fileId: "1",
      token: expired.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt",
      now: now.getTime(),
    });
    const r3 = await authorizeFileShare(db, {
      fileId: "1",
      token: limited.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt",
      now: now.getTime(),
    });
    expect(r1).toMatchObject({ status: 410, reason: "revoked" });
    expect(r2).toMatchObject({ status: 410, reason: "expired" });
    expect(r3).toMatchObject({ status: 410, reason: "exhausted" });
    expect(shareStatus((await getShareLink(db, revoked.token))!, now.getTime())).toBe("revoked");
  });

  it("redirects to the password page then unlocks with a cookie", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(db, { kind: "file", ids: ["1"], password: "hunter2" }, now);
    if (!created.ok) throw new Error("create");
    const blocked = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=tok",
    });
    expect(blocked.status).toBe(302);
    if (blocked.status !== 302) return;
    expect(blocked.location).toContain(`/share/${created.token}`);
    const bad = await verifySharePasswordAttempt(db, created.token, "nope", { secure: true, now });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.status).toBe(401);
    const good = await verifySharePasswordAttempt(db, created.token, "hunter2", {
      secure: true,
      now,
      next: "/dl/a.txt?t=tok",
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.setCookie).toContain("HttpOnly");
    expect(good.setCookie).toContain("ed_share_");
    expect(good.next).toBe("/dl/a.txt?t=tok");
    const opened = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: good.setCookie.split(";")[0],
      nextPath: "/dl/a.txt?t=tok",
      now: now.getTime(),
    });
    expect(opened.status).toBe(200);
  });

  it("locks after 5 wrong passwords", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(db, { kind: "file", ids: ["1"], password: "pw" }, now);
    if (!created.ok) throw new Error("create");
    for (let i = 0; i < SHARE_LOCK_AFTER - 1; i++) {
      const r = await verifySharePasswordAttempt(db, created.token, "bad", { secure: false, now });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(401);
    }
    const locked = await verifySharePasswordAttempt(db, created.token, "bad", { secure: false, now });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.status).toBe(429);
    const still = await verifySharePasswordAttempt(db, created.token, "pw", { secure: false, now });
    expect(still.ok).toBe(false);
    if (!still.ok) expect(still.status).toBe(429);
  });

  it("assigns a unique short code and can look the link up", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(db, { kind: "file", ids: ["1"] }, now);
    if (!created.ok) throw new Error("create");
    const short = await assignShareShortCode(db, created.token);
    expect(short.ok).toBe(true);
    if (!short.ok) return;
    expect(short.shortCode).toMatch(/^[0-9A-Za-z]{6,8}$/);
    const again = await assignShareShortCode(db, created.token);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.shortCode).toBe(short.shortCode);
  });

  it("deletes a link so later access is 404", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(db, { kind: "file", ids: ["1"] }, now);
    if (!created.ok) throw new Error("create");
    expect(await deleteShareLink(db, created.token)).toBe(true);
    expect(await getShareLink(db, created.token)).toBeNull();
    expect(await deleteShareLink(db, created.token)).toBe(false);
  });

  it("lets a batch token unlock member files", async () => {
    const db = memoryShare({
      files: [file({ id: "1", name: "a.txt" }), file({ id: "2", name: "b.txt" })],
    });
    const created = await createShare(db, { kind: "batch", ids: ["1", "2"] }, now);
    if (!created.ok) throw new Error("create");
    const link = await getShareLink(db, created.token);
    expect(link && shareAllowsFile(link, "1")).toBe(true);
    expect(link && shareAllowsFile(link, "2")).toBe(true);
    expect(link && shareAllowsFile(link, "nope")).toBe(false);
    const gate = await evaluateShareAccess(link, { nextPath: "/dl/batch/x" });
    expect(gate.status).toBe(200);
    if (gate.status === 200) expect(gate.countShare).toBe(false);
  });

  it("counts batch downloads per file and 410s only that file", async () => {
    const db = memoryShare({
      files: [file({ id: "1", name: "a.txt" }), file({ id: "2", name: "b.txt" })],
    });
    const created = await createShare(db, { kind: "batch", ids: ["1", "2"], max_downloads: 3 }, now);
    if (!created.ok) throw new Error("create");
    for (let i = 0; i < 3; i++) {
      const gate = await authorizeFileShare(db, {
        fileId: "1",
        token: created.token,
        cookieHeader: null,
        nextPath: "/dl/a.txt?t=x",
      });
      expect(gate.status).toBe(200);
      if (gate.status === 200) {
        expect(gate.countShare).toBe(false);
        expect(gate.countBatchFile).toBe(true);
      }
      await incrementShareFileCount(db, created.token, "1");
    }
    const exhausted = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=x",
    });
    expect(exhausted).toMatchObject({ status: 410, reason: "exhausted" });
    const other = await authorizeFileShare(db, {
      fileId: "2",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/b.txt?t=x",
    });
    expect(other.status).toBe(200);
    const page = await evaluateShareAccess(await getShareLink(db, created.token), { nextPath: "/dl/batch/x" });
    expect(page.status).toBe(200);
  });

  it("keeps file-link download_count exhaustion", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(db, { kind: "file", ids: ["1"], max_downloads: 1 }, now);
    if (!created.ok) throw new Error("create");
    const first = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt",
    });
    expect(first.status).toBe(200);
    if (first.status === 200) expect(first.countShare).toBe(true);
    await incrementShareDownload(db, created.token);
    const second = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt",
    });
    expect(second).toMatchObject({ status: 410, reason: "exhausted" });
  });

  it("404s single-file and view access when batch is pack-only", async () => {
    const db = memoryShare({
      files: [file({ id: "1", name: "a.txt" }), file({ id: "2", name: "b.txt" })],
    });
    const created = await createShare(db, { kind: "batch", ids: ["1", "2"], allow_preview: 0 }, now);
    if (!created.ok) throw new Error("create");
    const link = await getShareLink(db, created.token);
    expect(link?.allow_preview).toBe(0);
    expect(
      await authorizeFileShare(db, {
        fileId: "1",
        token: created.token,
        cookieHeader: null,
        nextPath: "/dl/a.txt?t=x",
      }),
    ).toEqual({ status: 404 });
    expect(
      await authorizeFileShare(db, {
        fileId: "1",
        token: created.token,
        cookieHeader: null,
        nextPath: "/dl/a.txt/view?t=x",
        view: true,
        bundle: true,
      }),
    ).toEqual({ status: 404 });
    const pack = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=x&bundle=1",
      bundle: true,
    });
    expect(pack.status).toBe(200);
  });

  it("rejects creating a share with neither download nor preview", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(
      db,
      { kind: "file", ids: ["1"], allow_download: 0, allow_preview: 0 },
      now,
    );
    expect(created).toMatchObject({ ok: false, status: 400, error: "need download or preview" });
  });

  it("preview-only file shares allow view/inline and 404 attachment downloads", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(
      db,
      { kind: "file", ids: ["1"], allow_download: 0, allow_preview: 1 },
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.url).toContain("/view?t=");
    expect(created.allowDownload).toBe(false);
    expect(created.allowPreview).toBe(true);
    expect(created.downloadUrl).toContain("/dl/a.txt?t=");
    expect(created.downloadUrl).not.toContain("/view");
    expect(created.viewUrl).toContain("/view?t=");
    const view = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt/view?t=x",
      view: true,
    });
    expect(view.status).toBe(200);
    const inline = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=x&inline=1",
      inline: true,
    });
    expect(inline.status).toBe(200);
    expect(
      await authorizeFileShare(db, {
        fileId: "1",
        token: created.token,
        cookieHeader: null,
        nextPath: "/dl/a.txt?t=x",
      }),
    ).toEqual({ status: 404 });
  });

  it("download-only file shares allow attachment and 404 preview", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(
      db,
      { kind: "file", ids: ["1"], allow_download: 1, allow_preview: 0 },
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.url).toContain("/dl/a.txt?t=");
    expect(created.viewUrl).toContain("/view?t=");
    expect(created.downloadUrl).toContain("/dl/a.txt?t=");
    expect(created.downloadUrl).not.toContain("/view");
    expect(
      await authorizeFileShare(db, {
        fileId: "1",
        token: created.token,
        cookieHeader: null,
        nextPath: "/dl/a.txt/view?t=x",
        view: true,
      }),
    ).toEqual({ status: 404 });
    const dl = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=x",
    });
    expect(dl.status).toBe(200);
  });

  it("preview-only batch shares hide downloads including bundle", async () => {
    const db = memoryShare({
      files: [file({ id: "1", name: "a.txt" }), file({ id: "2", name: "b.txt" })],
    });
    const created = await createShare(
      db,
      { kind: "batch", ids: ["1", "2"], allow_download: 0, allow_preview: 1 },
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.downloadUrl).toContain("mode=download");
    expect(created.viewUrl).toMatch(/^\/dl\/batch\//);
    const view = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt/view?t=x",
      view: true,
    });
    expect(view.status).toBe(200);
    expect(
      await authorizeFileShare(db, {
        fileId: "1",
        token: created.token,
        cookieHeader: null,
        nextPath: "/dl/a.txt?t=x",
      }),
    ).toEqual({ status: 404 });
    expect(
      await authorizeFileShare(db, {
        fileId: "1",
        token: created.token,
        cookieHeader: null,
        nextPath: "/dl/a.txt?t=x&bundle=1",
        bundle: true,
      }),
    ).toEqual({ status: 404 });
  });
});

describe("patchShare access flags / legacy links", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  it("always exposes download and preview URLs regardless of flags", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt", path: "docs" })] });
    const created = await createShare(
      db,
      { kind: "file", ids: ["1"], allow_download: 0, allow_preview: 1 },
      now,
    );
    if (!created.ok) throw new Error("create");
    const link = await getShareLink(db, created.token);
    expect(link).toBeTruthy();
    const copies = shareCopyPaths(link!, { path: "docs", name: "a.txt" });
    expect(copies.downloadUrl).toBe("/dl/docs/a.txt?t=" + created.token);
    expect(copies.viewUrl).toBe("/dl/docs/a.txt/view?t=" + created.token);
    const view = toShareView(link!, [file({ id: "1", name: "a.txt", path: "docs" })], now.getTime());
    expect(view.downloadUrl).toBe(copies.downloadUrl);
    expect(view.viewUrl).toBe(copies.viewUrl);
    expect(view.allow_download).toBe(false);
    expect(view.allow_preview).toBe(true);
  });

  it("full access lets the preview page download via the attachment URL", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(
      db,
      { kind: "file", ids: ["1"], allow_download: 1, allow_preview: 1 },
      now,
    );
    if (!created.ok) throw new Error("create");
    const preview = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt/view?t=x",
      view: true,
    });
    expect(preview.status).toBe(200);
    const fromPreview = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=x",
    });
    expect(fromPreview.status).toBe(200);
  });

  it("patches allow_download off then back on", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(db, { kind: "file", ids: ["1"] }, now);
    if (!created.ok) throw new Error("create");
    const off = await patchShare(db, created.token, { allow_download: 0 }, now);
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    expect(off.link.allow_download).toBe(false);
    expect(off.link.allow_preview).toBe(true);
    expect(
      await authorizeFileShare(db, {
        fileId: "1",
        token: created.token,
        cookieHeader: null,
        nextPath: "/dl/a.txt?t=x",
      }),
    ).toEqual({ status: 404 });
    const view = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt/view?t=x",
      view: true,
    });
    expect(view.status).toBe(200);
    const on = await patchShare(db, created.token, { allow_download: 1 }, now);
    expect(on.ok).toBe(true);
    if (!on.ok) return;
    expect(on.link.allow_download).toBe(true);
    const dl = await authorizeFileShare(db, {
      fileId: "1",
      token: created.token,
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=x",
    });
    expect(dl.status).toBe(200);
  });

  it("rejects patching both flags off", async () => {
    const db = memoryShare({ files: [file({ id: "1", name: "a.txt" })] });
    const created = await createShare(db, { kind: "file", ids: ["1"] }, now);
    if (!created.ok) throw new Error("create");
    const both = await patchShare(db, created.token, { allow_download: 0, allow_preview: 0 }, now);
    expect(both).toMatchObject({ ok: false, status: 400, error: "need download or preview" });
    const previewOnly = await patchShare(db, created.token, { allow_download: 0, allow_preview: 1 }, now);
    expect(previewOnly.ok).toBe(true);
    const collapsed = await patchShare(db, created.token, { allow_preview: 0 }, now);
    expect(collapsed).toMatchObject({ ok: false, status: 400, error: "need download or preview" });
    const still = await getShareLink(db, created.token);
    expect(still?.allow_download).toBe(0);
    expect(still?.allow_preview).toBe(1);
  });

  it("treats legacy rows with null allow_download as download+preview allowed", async () => {
    const db = memoryShare({
      files: [file({ id: "1", name: "a.txt" })],
      links: [
        {
          token: "legacy",
          kind: "file",
          target: "1",
          password_hash: null,
          max_downloads: null,
          download_count: 0,
          created_at: now.toISOString(),
          expires_at: null,
          revoked: 0,
          short_code: null,
          fail_count: 0,
          locked_until: null,
          allow_preview: null,
          allow_download: null,
        },
      ],
    });
    const link = await getShareLink(db, "legacy");
    expect(link?.allow_download).toBe(1);
    expect(link?.allow_preview).toBe(1);
    expect(shareAllowsDownload({ allow_download: null })).toBe(true);
    const view = await authorizeFileShare(db, {
      fileId: "1",
      token: "legacy",
      cookieHeader: null,
      nextPath: "/dl/a.txt/view?t=legacy",
      view: true,
    });
    expect(view.status).toBe(200);
    const dl = await authorizeFileShare(db, {
      fileId: "1",
      token: "legacy",
      cookieHeader: null,
      nextPath: "/dl/a.txt?t=legacy",
    });
    expect(dl.status).toBe(200);
  });
});
