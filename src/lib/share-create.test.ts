import { describe, expect, it } from "vitest";
import { buildShareCreateBody, shareAccessValid } from "./share-create";

describe("shareAccessValid", () => {
  it("rejects the empty quadrant", () => {
    expect(shareAccessValid(true, true)).toBe(true);
    expect(shareAccessValid(true, false)).toBe(true);
    expect(shareAccessValid(false, true)).toBe(true);
    expect(shareAccessValid(false, false)).toBe(false);
  });
});

describe("buildShareCreateBody", () => {
  it("builds a file share with both flags on by default", () => {
    const built = buildShareCreateBody({
      ids: ["a"],
      allowDownload: true,
      allowPreview: true,
    });
    expect(built).toEqual({
      ok: true,
      body: { kind: "file", ids: ["a"], allow_download: 1, allow_preview: 1 },
    });
  });

  it("builds a preview-only batch share with optional limits", () => {
    const built = buildShareCreateBody({
      ids: ["a", "b"],
      allowDownload: false,
      allowPreview: true,
      password: " secret ",
      maxDownloads: "3",
      expireMode: "dur",
      expireN: "12",
      expireUnit: "hours",
      short: true,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body).toMatchObject({
      kind: "batch",
      ids: ["a", "b"],
      allow_download: 0,
      allow_preview: 1,
      password: "secret",
      max_downloads: 3,
      hours: 12,
      short: true,
    });
  });

  it("rejects empty ids, 0/0, and bad max", () => {
    expect(buildShareCreateBody({ ids: [], allowDownload: true, allowPreview: true })).toEqual({
      ok: false,
      error: "need-ids",
    });
    expect(buildShareCreateBody({ ids: ["a"], allowDownload: false, allowPreview: false })).toEqual({
      ok: false,
      error: "need-access",
    });
    expect(
      buildShareCreateBody({ ids: ["a"], allowDownload: true, allowPreview: true, maxDownloads: "0" }),
    ).toEqual({ ok: false, error: "invalid-max" });
  });
});
