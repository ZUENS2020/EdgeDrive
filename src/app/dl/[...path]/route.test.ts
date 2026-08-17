import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getFileByKey = vi.fn();
const getSettings = vi.fn();
const getDB = vi.fn();
const getR2 = vi.fn();
const authorizeFileShare = vi.fn();
const scheduleDownloadIncrement = vi.fn();
const scheduleShareDownloadIncrement = vi.fn();
const scheduleShareFileCountIncrement = vi.fn();

vi.mock("@/lib/store", () => ({
  getFileByKey: (...args: unknown[]) => getFileByKey(...args),
}));

vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  return { ...actual, getSettings: () => getSettings() };
});

vi.mock("@/lib/cloudflare", () => ({
  getDB: () => getDB(),
  getR2: () => getR2(),
}));

vi.mock("@/lib/share", async () => {
  const actual = await vi.importActual<typeof import("@/lib/share")>("@/lib/share");
  return {
    ...actual,
    authorizeFileShare: (...args: unknown[]) => authorizeFileShare(...args),
  };
});

vi.mock("@/lib/download-count", () => ({
  shouldCountDownload: () => true,
  scheduleDownloadIncrement: (...args: unknown[]) => scheduleDownloadIncrement(...args),
  scheduleShareDownloadIncrement: (...args: unknown[]) => scheduleShareDownloadIncrement(...args),
  scheduleShareFileCountIncrement: (...args: unknown[]) => scheduleShareFileCountIncrement(...args),
}));

import { GET } from "./route";

function request(path: string) {
  return new NextRequest(`https://edgedrive.example${path}`);
}

const meta = {
  id: "1",
  name: "a.txt",
  path: "docs",
  size: 4,
  mime: "text/plain",
  expires: null,
  download_count: 0,
  created_at: "2026-08-16T00:00:00.000Z",
  tags: "",
  deleted_at: null,
  starred: 0,
  sha256: null,
};

describe("GET /dl/[...path]", () => {
  beforeEach(() => {
    getFileByKey.mockReset();
    getSettings.mockReset();
    getDB.mockReset();
    getR2.mockReset();
    authorizeFileShare.mockReset();
    scheduleDownloadIncrement.mockReset();
    scheduleShareDownloadIncrement.mockReset();
    scheduleShareFileCountIncrement.mockReset();
    getSettings.mockResolvedValue({ theme_name: "default", language: "zh" });
    getDB.mockResolvedValue({});
    getFileByKey.mockResolvedValue(meta);
  });

  it("404s old direct links without a token", async () => {
    authorizeFileShare.mockResolvedValue({ status: 404 });
    const res = await GET(request("/dl/docs/a.txt"), { params: Promise.resolve({ path: ["docs", "a.txt"] }) });
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("404");
    expect(authorizeFileShare).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ fileId: "1", token: null }),
    );
  });

  it("302s to the password page when the share is locked", async () => {
    authorizeFileShare.mockResolvedValue({ status: 302, location: "/share/tok?next=%2Fdl%2Fdocs%2Fa.txt%3Ft%3Dtok" });
    const res = await GET(request("/dl/docs/a.txt?t=tok"), {
      params: Promise.resolve({ path: ["docs", "a.txt"] }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/share/tok");
  });

  it("410s revoked shares", async () => {
    authorizeFileShare.mockResolvedValue({ status: 410, reason: "revoked" });
    const res = await GET(request("/dl/docs/a.txt?t=tok"), {
      params: Promise.resolve({ path: ["docs", "a.txt"] }),
    });
    expect(res.status).toBe(410);
  });

  it("serves the file when the token is valid", async () => {
    authorizeFileShare.mockResolvedValue({
      status: 200,
      link: { token: "tok", kind: "file" },
      countShare: true,
    });
    getR2.mockResolvedValue({
      get: async () => ({
        body: new Uint8Array([1, 2, 3, 4]),
        size: 4,
        httpEtag: '"x"',
        httpMetadata: { contentType: "text/plain" },
      }),
    });
    const res = await GET(request("/dl/docs/a.txt?t=tok"), {
      params: Promise.resolve({ path: ["docs", "a.txt"] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(scheduleDownloadIncrement).toHaveBeenCalledWith("1");
    expect(scheduleShareDownloadIncrement).toHaveBeenCalledWith("tok");
  });

  it("increments per-file batch counts and skips share download_count", async () => {
    authorizeFileShare.mockResolvedValue({
      status: 200,
      link: { token: "batch", kind: "batch" },
      countShare: false,
      countBatchFile: true,
    });
    getR2.mockResolvedValue({
      get: async () => ({
        body: new Uint8Array([1, 2, 3, 4]),
        size: 4,
        httpEtag: '"x"',
        httpMetadata: { contentType: "text/plain" },
      }),
    });
    const res = await GET(request("/dl/docs/a.txt?t=batch&bundle=1"), {
      params: Promise.resolve({ path: ["docs", "a.txt"] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(scheduleShareDownloadIncrement).not.toHaveBeenCalled();
    expect(scheduleShareFileCountIncrement).toHaveBeenCalledWith("batch", "1");
  });
});
