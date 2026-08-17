import { beforeEach, describe, expect, it, vi } from "vitest";

const getDB = vi.fn();
const getSettings = vi.fn();

vi.mock("@/lib/cloudflare", () => ({
  getDB: () => getDB(),
}));

vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  return {
    ...actual,
    getSettings: () => getSettings(),
  };
});

import { NextRequest } from "next/server";
import { GET } from "./route";

function request(path: string) {
  return new NextRequest(`https://edgedrive.example${path}`);
}

function memoryBatch(init: {
  batches?: {
    token: string;
    file_ids: string;
    created_at: string;
    expires_at: string | null;
    allow_preview?: number;
    allow_download?: number;
  }[];
  files?: { id: string; name: string; path: string; size: number; mime: string | null; expires: string | null; download_count: number; created_at: string; tags: string }[];
}): D1Database {
  const files = new Map((init.files ?? []).map((row) => [row.id, row]));
  const batches = new Map((init.batches ?? []).map((row) => [row.token, row]));
  const api = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (normalized.includes("FROM share_links") && normalized.includes("WHERE token")) {
                const row = batches.get(String(args[0]));
                if (!row) return null;
                return {
                  token: row.token,
                  kind: "batch",
                  target: row.file_ids,
                  password_hash: null,
                  max_downloads: null,
                  download_count: 0,
                  created_at: row.created_at,
                  expires_at: row.expires_at,
                  revoked: 0,
                  short_code: null,
                  fail_count: 0,
                  locked_until: null,
                  allow_preview: row.allow_preview ?? 1,
                  allow_download: row.allow_download ?? 1,
                } as T;
              }
              if (normalized.includes("FROM batch_links") && normalized.includes("WHERE token")) {
                return (batches.get(String(args[0])) ?? null) as T;
              }
              return null;
            },
            async all<T>() {
              if (normalized.includes("FROM files") && normalized.includes("id IN")) {
                const results = args.map((id) => files.get(String(id))).filter(Boolean);
                return { results: results as T[] };
              }
              return { results: [] as T[] };
            },
            async run() {
              return { success: true };
            },
          };
        },
      };
    },
  };
  return api as unknown as D1Database;
}

describe("GET /dl/batch/[token]", () => {
  beforeEach(() => {
    getDB.mockReset();
    getSettings.mockReset();
    getSettings.mockResolvedValue({ theme_name: "default" });
  });

  it("404s an unknown token", async () => {
    getDB.mockResolvedValue(memoryBatch({}));
    const res = await GET(request("/dl/batch/nope"), { params: Promise.resolve({ token: "nope" }) });
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("404");
  });

  it("410s an expired batch", async () => {
    getDB.mockResolvedValue(
      memoryBatch({
        batches: [
          {
            token: "old",
            file_ids: "[]",
            created_at: "2026-01-01T00:00:00.000Z",
            expires_at: "2026-01-02T00:00:00.000Z",
          },
        ],
      }),
    );
    const res = await GET(request("/dl/batch/old"), { params: Promise.resolve({ token: "old" }) });
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("410");
  });

  it("renders the file list for a live token", async () => {
    getDB.mockResolvedValue(
      memoryBatch({
        batches: [
          {
            token: "live",
            file_ids: JSON.stringify(["1"]),
            created_at: "2026-08-16T00:00:00.000Z",
            expires_at: null,
          },
        ],
        files: [
          {
            id: "1",
            name: "pack.zip",
            path: "",
            size: 10,
            mime: "application/zip",
            expires: null,
            download_count: 0,
            created_at: "2026-08-16T00:00:00.000Z",
            tags: "",
          },
        ],
      }),
    );
    const res = await GET(request("/dl/batch/live"), { params: Promise.resolve({ token: "live" }) });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("1 个文件");
    expect(html).toContain("pack.zip");
    expect(html).toContain("https://edgedrive.example/dl/pack.zip/view?t=live");
    expect(html).toContain("https://edgedrive.example/dl/pack.zip?t=live");
    expect(html).not.toContain("DOMContentLoaded");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Cache-Control")).not.toContain("public");
  });

  it("uses the forwarded public origin on per-file hrefs", async () => {
    getDB.mockResolvedValue(
      memoryBatch({
        batches: [
          {
            token: "live",
            file_ids: JSON.stringify(["1"]),
            created_at: "2026-08-16T00:00:00.000Z",
            expires_at: null,
          },
        ],
        files: [
          {
            id: "1",
            name: "pack.zip",
            path: "",
            size: 10,
            mime: "application/zip",
            expires: null,
            download_count: 0,
            created_at: "2026-08-16T00:00:00.000Z",
            tags: "",
          },
        ],
      }),
    );
    const req = new NextRequest("http://localhost:8787/dl/batch/live", {
      headers: {
        host: "localhost:8787",
        "x-forwarded-host": "dlp.zuens2020.work",
        "x-forwarded-proto": "https",
      },
    });
    const res = await GET(req, { params: Promise.resolve({ token: "live" }) });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("https://dlp.zuens2020.work/dl/pack.zip/view?t=live");
    expect(html).not.toContain("http://localhost:8787/dl/pack.zip");
  });

  it("pack-only batch pages hide the file list", async () => {
    getDB.mockResolvedValue(
      memoryBatch({
        batches: [
          {
            token: "pack",
            file_ids: JSON.stringify(["1"]),
            created_at: "2026-08-16T00:00:00.000Z",
            expires_at: null,
            allow_preview: 0,
          },
        ],
        files: [
          {
            id: "1",
            name: "pack.zip",
            path: "",
            size: 10,
            mime: "application/zip",
            expires: null,
            download_count: 0,
            created_at: "2026-08-16T00:00:00.000Z",
            tags: "",
          },
        ],
      }),
    );
    const res = await GET(request("/dl/batch/pack"), { params: Promise.resolve({ token: "pack" }) });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("全部下载");
    expect(html).toContain("1 个文件");
    expect(html).not.toContain("/dl/pack.zip/view");
    expect(html).not.toContain('class="list"');
    expect(html).not.toContain('class="row"');
    expect(html).toContain("bundle=1");
  });

  it("preview-only batch pages keep the list and hide downloads", async () => {
    getDB.mockResolvedValue(
      memoryBatch({
        batches: [
          {
            token: "peek",
            file_ids: JSON.stringify(["1"]),
            created_at: "2026-08-16T00:00:00.000Z",
            expires_at: null,
            allow_preview: 1,
            allow_download: 0,
          },
        ],
        files: [
          {
            id: "1",
            name: "pack.zip",
            path: "",
            size: 10,
            mime: "application/zip",
            expires: null,
            download_count: 0,
            created_at: "2026-08-16T00:00:00.000Z",
            tags: "",
          },
        ],
      }),
    );
    const res = await GET(request("/dl/batch/peek?mode=download"), {
      params: Promise.resolve({ token: "peek" }),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("pack.zip");
    expect(html).toContain("/dl/pack.zip/view?t=peek");
    expect(html).not.toContain("全部下载");
    expect(html).not.toContain("DOMContentLoaded");
  });

  it("auto-download mode includes the staggered trigger", async () => {
    getDB.mockResolvedValue(
      memoryBatch({
        batches: [
          {
            token: "live",
            file_ids: JSON.stringify(["1"]),
            created_at: "2026-08-16T00:00:00.000Z",
            expires_at: null,
          },
        ],
        files: [
          {
            id: "1",
            name: "pack.zip",
            path: "",
            size: 10,
            mime: "application/zip",
            expires: null,
            download_count: 0,
            created_at: "2026-08-16T00:00:00.000Z",
            tags: "",
          },
        ],
      }),
    );
    const res = await GET(request("/dl/batch/live?mode=download"), {
      params: Promise.resolve({ token: "live" }),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("DOMContentLoaded");
    expect(html).toContain("如被拦截");
  });
});
