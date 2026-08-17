import { describe, expect, it } from "vitest";
import { renderBatchPage } from "./batch-page";
import { publicThemeVars } from "./themes";
import type { FileRow } from "./types";

function file(partial: Partial<FileRow> & Pick<FileRow, "id" | "name">): FileRow {
  return {
    path: "docs",
    size: 2048,
    mime: "image/png",
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

const theme = publicThemeVars("default");

describe("renderBatchPage", () => {
  it("lists files with preview and download links", () => {
    const html = renderBatchPage({
      origin: "https://edgedrive.example",
      files: [file({ id: "1", name: "photo.png" }), file({ id: "2", name: "notes.pdf", mime: "application/pdf" })],
      expiresAt: null,
      autoDownload: false,
      theme,
    });
    expect(html).toContain("2 个文件");
    expect(html).toContain("永久");
    expect(html).toContain("photo.png");
    expect(html).toContain("notes.pdf");
    expect(html).toContain("https://edgedrive.example/dl/docs/photo.png/view");
    expect(html).toContain("https://edgedrive.example/dl/docs/photo.png");
    expect(html).toContain("全部下载");
    expect(html).not.toContain("如被拦截");
    expect(html).not.toContain("DOMContentLoaded");
  });

  it("stamps the share token onto per-file urls", () => {
    const html = renderBatchPage({
      origin: "https://edgedrive.example",
      files: [file({ id: "1", name: "photo.png" })],
      expiresAt: null,
      autoDownload: false,
      theme,
      token: "tok",
    });
    expect(html).toContain("https://edgedrive.example/dl/docs/photo.png/view?t=tok");
    expect(html).toContain("https://edgedrive.example/dl/docs/photo.png?t=tok");
  });

  it("auto-download mode injects staggered clicks and a blocker hint", () => {
    const html = renderBatchPage({
      origin: "https://x",
      files: [file({ id: "1", name: "a.txt", mime: "text/plain" })],
      expiresAt: "2026-09-01T00:00:00.000Z",
      autoDownload: true,
      theme,
      now: Date.parse("2026-08-16T00:00:00.000Z"),
    });
    expect(html).toContain("如被拦截请点下方「全部下载」或允许浏览器下载");
    expect(html).toContain("DOMContentLoaded");
    expect(html).toContain("triggerDownloads(FILES)");
    expect(html).toContain("var GAP = 300");
    expect(html).toContain("有效期至");
  });

  it("escapes HTML in file names", () => {
    const html = renderBatchPage({
      origin: "https://x",
      files: [file({ id: "1", name: "<script>alert(1)</script>.txt" })],
      expiresAt: null,
      autoDownload: false,
      theme,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;.txt");
  });

  it("renders an empty-state when every file was deleted", () => {
    const html = renderBatchPage({
      origin: "https://x",
      files: [],
      expiresAt: null,
      autoDownload: false,
      theme,
    });
    expect(html).toContain("0 个文件");
    expect(html).toContain("这些文件已被删除。");
  });

  it("renders English copy when locale is en", () => {
    const html = renderBatchPage({
      origin: "https://x",
      files: [file({ id: "1", name: "a.txt", mime: "text/plain" })],
      expiresAt: null,
      autoDownload: true,
      theme,
      locale: "en",
    });
    expect(html).toContain("1 file");
    expect(html).toContain("Download all");
    expect(html).toContain("If the browser blocks");
    expect(html).toContain('lang="en"');
    expect(html).not.toContain("全部下载");
  });

  it("pack-only mode shows download-all without a file list", () => {
    const html = renderBatchPage({
      origin: "https://edgedrive.example",
      files: [file({ id: "1", name: "photo.png" }), file({ id: "2", name: "notes.pdf", mime: "application/pdf" })],
      expiresAt: null,
      autoDownload: false,
      theme,
      token: "tok",
      packOnly: true,
    });
    expect(html).toContain("下载全部");
    expect(html).toContain("2 个文件 · 4.0 KB");
    expect(html).toContain("全部下载");
    expect(html).not.toContain("/view?t=tok");
    expect(html).not.toContain('class="list"');
    expect(html).not.toContain('class="row"');
    expect(html).toContain("bundle=1");
  });

  it("preview-only mode lists files without download buttons", () => {
    const html = renderBatchPage({
      origin: "https://edgedrive.example",
      files: [file({ id: "1", name: "photo.png" })],
      expiresAt: null,
      autoDownload: true,
      theme,
      token: "tok",
      allowDownload: false,
      allowPreview: true,
    });
    expect(html).toContain("/view?t=tok");
    expect(html).toContain("预览");
    expect(html).not.toContain("全部下载");
    expect(html).not.toContain("DOMContentLoaded");
    expect(html).not.toContain('download="photo.png"');
  });
});
