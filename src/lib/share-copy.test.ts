import { describe, expect, it } from "vitest";
import { shareCopyRows } from "./share-copy";

describe("shareCopyRows", () => {
  const both = {
    downloadUrl: "/dl/docs/a.txt?t=tok",
    viewUrl: "/dl/docs/a.txt/view?t=tok",
  };

  it("enables both rows when download and preview are allowed", () => {
    expect(shareCopyRows({ ...both, allowDownload: true, allowPreview: true })).toEqual([
      { kind: "download", path: both.downloadUrl, enabled: true },
      { kind: "preview", path: both.viewUrl, enabled: true },
    ]);
  });

  it("keeps the download path visible but disabled when allow_download=0", () => {
    expect(shareCopyRows({ ...both, allowDownload: false, allowPreview: true })).toEqual([
      { kind: "download", path: both.downloadUrl, enabled: false },
      { kind: "preview", path: both.viewUrl, enabled: true },
    ]);
  });

  it("keeps the preview path visible but disabled when allow_preview=0", () => {
    expect(shareCopyRows({ ...both, allowDownload: true, allowPreview: false })).toEqual([
      { kind: "download", path: both.downloadUrl, enabled: true },
      { kind: "preview", path: both.viewUrl, enabled: false },
    ]);
  });

  it("disables a row when its URL is missing", () => {
    expect(
      shareCopyRows({
        downloadUrl: "  ",
        viewUrl: null,
        allowDownload: true,
        allowPreview: true,
      }),
    ).toEqual([
      { kind: "download", path: "", enabled: false },
      { kind: "preview", path: "", enabled: false },
    ]);
  });
});
