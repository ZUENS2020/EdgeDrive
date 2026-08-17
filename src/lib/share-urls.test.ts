import { describe, expect, it } from "vitest";
import {
  absoluteCopyUrl,
  adminFileContentPath,
  adminFileViewPath,
  batchSharePaths,
  fileLongPath,
  isAbsoluteHttpUrl,
  originJoin,
  requestOrigin,
  shortSharePath,
} from "./share-urls";

const ORIGIN = "https://dlp.zuens2020.work";

describe("originJoin / absoluteCopyUrl", () => {
  it("turns relative share paths into absolute http(s) URLs", () => {
    expect(absoluteCopyUrl(fileLongPath({ path: "", name: "a.txt" }, "tok"), ORIGIN)).toBe(
      "https://dlp.zuens2020.work/dl/a.txt?t=tok",
    );
    expect(absoluteCopyUrl(fileLongPath({ path: "docs", name: "a.txt" }, "tok", true), ORIGIN)).toBe(
      "https://dlp.zuens2020.work/dl/docs/a.txt/view?t=tok",
    );
    expect(absoluteCopyUrl(batchSharePaths("batchTok").previewUrl, ORIGIN)).toBe(
      "https://dlp.zuens2020.work/dl/batch/batchTok",
    );
    expect(absoluteCopyUrl(batchSharePaths("batchTok").downloadUrl, ORIGIN)).toBe(
      "https://dlp.zuens2020.work/dl/batch/batchTok?mode=download",
    );
    expect(absoluteCopyUrl(shortSharePath("Ab1"), ORIGIN)).toBe("https://dlp.zuens2020.work/s/Ab1");
    expect(absoluteCopyUrl(adminFileViewPath("file-id"), ORIGIN)).toBe(
      "https://dlp.zuens2020.work/api/files/file-id/view",
    );
    expect(absoluteCopyUrl(adminFileContentPath("file-id"), ORIGIN)).toBe(
      "https://dlp.zuens2020.work/api/files/file-id/content",
    );
  });

  it("does not double-prefix an already-absolute URL (unlike origin+path concat)", () => {
    const abs = "https://dlp.zuens2020.work/s/Ab1";
    expect(`${ORIGIN}${abs}`).toBe("https://dlp.zuens2020.workhttps://dlp.zuens2020.work/s/Ab1");
    expect(absoluteCopyUrl(abs, ORIGIN)).toBe(abs);
    expect(originJoin(ORIGIN, "/dl/a.txt")).toBe("https://dlp.zuens2020.work/dl/a.txt");
    expect(originJoin("https://dlp.zuens2020.work/", "dl/a.txt")).toBe("https://dlp.zuens2020.work/dl/a.txt");
  });

  it("recognizes http(s) absolute URLs", () => {
    expect(isAbsoluteHttpUrl("https://x/a")).toBe(true);
    expect(isAbsoluteHttpUrl("HTTP://x/a")).toBe(true);
    expect(isAbsoluteHttpUrl("/api/files/x/view")).toBe(false);
  });
});

describe("requestOrigin", () => {
  it("uses the request URL when no forwarding headers are present", () => {
    expect(requestOrigin(new Request("https://dlp.zuens2020.work/api/files/abc/view"))).toBe(
      "https://dlp.zuens2020.work",
    );
  });

  it("prefers x-forwarded-host + proto over the internal worker URL", () => {
    const req = new Request("http://localhost:8787/api/files/abc/view", {
      headers: {
        host: "localhost:8787",
        "x-forwarded-host": "dlp.zuens2020.work",
        "x-forwarded-proto": "https",
      },
    });
    expect(requestOrigin(req)).toBe("https://dlp.zuens2020.work");
  });

  it("falls back to Host when forwarded-host is absent", () => {
    const req = new Request("https://edgedrive.workers.dev/dl/a.txt/view", {
      headers: { host: "dlp.zuens2020.work", "x-forwarded-proto": "https" },
    });
    expect(requestOrigin(req)).toBe("https://dlp.zuens2020.work");
  });

  it("takes the first value of comma-separated forwarded headers", () => {
    const req = new Request("http://127.0.0.1/x", {
      headers: {
        "x-forwarded-host": "dlp.zuens2020.work, localhost",
        "x-forwarded-proto": "https, http",
      },
    });
    expect(requestOrigin(req)).toBe("https://dlp.zuens2020.work");
  });

  it("ignores APP_URL / NEXT_PUBLIC_BASE_URL so a stale env cannot poison copied links", () => {
    const prevApp = process.env.APP_URL;
    const prevPublic = process.env.NEXT_PUBLIC_BASE_URL;
    process.env.APP_URL = "https://stale.example";
    process.env.NEXT_PUBLIC_BASE_URL = "https://stale.example";
    try {
      expect(requestOrigin(new Request("https://dlp.zuens2020.work/s/x"))).toBe("https://dlp.zuens2020.work");
    } finally {
      if (prevApp === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevApp;
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
      else process.env.NEXT_PUBLIC_BASE_URL = prevPublic;
    }
  });
});
