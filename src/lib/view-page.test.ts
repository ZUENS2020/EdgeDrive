import { describe, expect, it } from "vitest";
import { fileKind, isInlineSafe, previewKind } from "./format";
import { extractMermaidBlocks, renderViewPage, TEXT_PREVIEW_MAX_BYTES, viewPageAbsoluteHrefs, viewPageClientJs } from "./view-page";
import { publicThemeVars } from "./themes";
import type { FileRow } from "./types";

function file(partial: Partial<FileRow> & Pick<FileRow, "id" | "name">): FileRow {
  return {
    path: "",
    size: 2048,
    mime: null,
    expires: null,
    download_count: 0,
    created_at: "2026-08-16T08:00:00.000Z",
    tags: "",
    deleted_at: null,
    starred: 0,
    sha256: null,
    ...partial,
  };
}

const theme = publicThemeVars("default");

describe("previewKind / inline", () => {
  it("classifies media and text", () => {
    expect(previewKind("a.png", "image/png")).toBe("img");
    expect(previewKind("a.mp4", "video/mp4")).toBe("vid");
    expect(previewKind("a.mp3", "audio/mpeg")).toBe("audio");
    expect(previewKind("a.pdf", "application/pdf")).toBe("pdf");
    expect(previewKind("readme.md", "text/markdown")).toBe("md");
    expect(previewKind("notes.txt", "text/plain")).toBe("txt");
    expect(previewKind("data.json", "application/json")).toBe("txt");
    expect(previewKind("x.bin", "application/octet-stream")).toBe("none");
    expect(fileKind("song.mp3")).toBe("audio");
  });

  it("blocks svg/html from inline preview", () => {
    expect(isInlineSafe("x.svg", "image/svg+xml")).toBe(false);
    expect(isInlineSafe("x.html", "text/html")).toBe(false);
    expect(isInlineSafe("pic.png", "image/png")).toBe(true);
    expect(isInlineSafe("doc.md", "text/markdown")).toBe(true);
  });
});

describe("extractMermaidBlocks", () => {
  it("lifts mermaid fences into placeholders", () => {
    const src = "# Hi\n\n```mermaid\ngraph TD; A-->B\n```\n\nok";
    const { markdown, blocks } = extractMermaidBlocks(src);
    expect(blocks).toEqual(["graph TD; A-->B\n"]);
    expect(markdown).toContain("EDMERMAIDPLACEHOLDER0ENDPLACEHOLDER");
    expect(markdown).not.toContain("```mermaid");
  });
});

describe("renderViewPage", () => {
  it("renders video with playsinline and Range-friendly inline src", () => {
    const html = renderViewPage({
      origin: "https://edgedrive.example",
      key: "clips/a.mp4",
      meta: file({ id: "1", name: "a.mp4", mime: "video/mp4", path: "clips" }),
      theme,
    });
    expect(html).toContain("playsinline");
    expect(html).toContain('src="https://edgedrive.example/dl/clips/a.mp4?inline=1"');
    expect(html).toContain("preload=\"metadata\"");
    expect(html).toContain("复制下载链接");
    expect(html).toContain("复制预览链接");
    expect(html).toContain("上传时间");
    expect(html).toContain("@media (max-width:640px)");
  });

  it("keeps token on download, view, and inline urls", () => {
    const html = renderViewPage({
      origin: "https://edgedrive.example",
      key: "clips/a.mp4",
      meta: file({ id: "1", name: "a.mp4", mime: "video/mp4", path: "clips" }),
      theme,
      token: "tok",
    });
    expect(html).toContain("t=tok&amp;inline=1");
    expect(html).toContain('href="https://edgedrive.example/dl/clips/a.mp4?t=tok"');
    expect(html).toContain("https://edgedrive.example/dl/clips/a.mp4/view?t=tok");
  });

  it("renders image lightbox controls", () => {
    const html = renderViewPage({
      origin: "https://x",
      key: "pic.png",
      meta: file({ id: "1", name: "pic.png", mime: "image/png" }),
      theme,
    });
    expect(html).toContain('id="ed-img"');
    expect(html).toContain('id="ed-box"');
    expect(html).toContain('data-lb="zoom-in"');
    expect(html).toContain('data-lb="rot"');
    expect(html).toContain("cursor:zoom-in");
  });

  it("puts PDF / Markdown / TXT inside a max-height scroll frame", () => {
    const pdf = renderViewPage({
      origin: "https://x",
      key: "a.pdf",
      meta: file({ id: "1", name: "a.pdf", mime: "application/pdf" }),
      theme,
    });
    expect(pdf).toContain("preview-frame");
    expect(pdf).toContain("max-height:70vh");
    expect(pdf).toContain("overflow:auto");
    expect(pdf).toContain("<iframe class=\"pdf\"");

    const md = renderViewPage({
      origin: "https://x",
      key: "readme.md",
      meta: file({ id: "1", name: "readme.md", mime: "text/markdown" }),
      theme,
    });
    expect(md).toContain("id=\"ed-md\"");
    expect(md).toContain("marked.min.js");
    expect(md).toContain("mermaid");
    expect(md).toContain("highlight.min.js");
    expect(md).toContain("purify.min.js");
    expect(md).toContain("EDMERMAIDPLACEHOLDER");
    expect(viewPageClientJs()).toContain(String(TEXT_PREVIEW_MAX_BYTES));

    const txt = renderViewPage({
      origin: "https://x",
      key: "notes.txt",
      meta: file({ id: "1", name: "notes.txt", mime: "text/plain" }),
      theme: publicThemeVars("light"),
    });
    expect(txt).toContain("id=\"ed-txt\"");
    expect(txt).toContain("正在载入文本");

    const en = renderViewPage({
      origin: "https://x",
      key: "notes.txt",
      meta: file({ id: "1", name: "notes.txt", mime: "text/plain" }),
      theme: publicThemeVars("light"),
      locale: "en",
    });
    expect(en).toContain("Loading text");
    expect(en).toContain('lang="en"');
    expect(en).not.toContain("正在载入文本");
  });

  it("escapes HTML in file names and includes audio controls", () => {
    const html = renderViewPage({
      origin: "https://x",
      key: "<script>.mp3",
      meta: file({ id: "1", name: "<script>.mp3", mime: "audio/mpeg" }),
      theme,
    });
    expect(html).not.toContain("<script>.mp3");
    expect(html).toContain("&lt;script&gt;.mp3");
    expect(html).toContain("<audio class=\"preview-media\" controls");
  });

  it("absolutizes relative admin preview hrefs used by 复制链接", () => {
    const hrefs = viewPageAbsoluteHrefs({
      origin: "https://dlp.zuens2020.work",
      key: "a.txt",
      downloadHref: "/api/files/abc/content",
      inlineHref: "/api/files/abc/content?inline=1",
      viewHref: "/api/files/abc/view",
    });
    expect(hrefs).toEqual({
      download: "https://dlp.zuens2020.work/api/files/abc/content",
      inline: "https://dlp.zuens2020.work/api/files/abc/content?inline=1",
      view: "https://dlp.zuens2020.work/api/files/abc/view",
    });
    const html = renderViewPage({
      origin: "https://dlp.zuens2020.work",
      key: "a.txt",
      meta: file({ id: "abc", name: "a.txt", mime: "text/plain" }),
      theme,
      downloadHref: "/api/files/abc/content",
      inlineHref: "/api/files/abc/content?inline=1",
      viewHref: "/api/files/abc/view",
    });
    expect(html).toContain('data-copy="https://dlp.zuens2020.work/api/files/abc/content"');
    expect(html).toContain('data-copy="https://dlp.zuens2020.work/api/files/abc/view"');
    expect(html).not.toMatch(/data-copy="\/api\/files/);
    expect(html).toContain('href="https://dlp.zuens2020.work/api/files/abc/content"');
  });

  it("hides download actions when allowDownload is false", () => {
    const html = renderViewPage({
      origin: "https://edgedrive.example",
      key: "a.txt",
      meta: file({ id: "1", name: "a.txt", mime: "text/plain" }),
      theme,
      token: "tok",
      allowDownload: false,
    });
    expect(html).not.toContain("复制下载链接");
    expect(html).not.toContain(">下载<");
    expect(html).toContain("复制预览链接");
    expect(html).toContain("/dl/a.txt/view?t=tok");
  });

  it("keeps preview-page download actions when allowDownload is true", () => {
    const html = renderViewPage({
      origin: "https://edgedrive.example",
      key: "a.txt",
      meta: file({ id: "1", name: "a.txt", mime: "text/plain" }),
      theme,
      token: "tok",
      allowDownload: true,
    });
    expect(html).toContain("复制下载链接");
    expect(html).toContain(">下载<");
    expect(html).toContain('href="https://edgedrive.example/dl/a.txt?t=tok"');
    expect(html).toContain("复制预览链接");
  });

  it("copies short /s/ URLs when copy hrefs are provided", () => {
    const html = renderViewPage({
      origin: "https://edgedrive.example",
      key: "a.txt",
      meta: file({ id: "1", name: "a.txt", mime: "text/plain" }),
      theme,
      token: "tok",
      copyDownloadHref: "/s/Ab12Cd",
      copyViewHref: "/s/Xy98Zq",
    });
    expect(html).toContain('data-copy="https://edgedrive.example/s/Ab12Cd"');
    expect(html).toContain('data-copy="https://edgedrive.example/s/Xy98Zq"');
    expect(html).toContain('href="https://edgedrive.example/dl/a.txt?t=tok"');
    expect(html).not.toMatch(/data-copy="https:\/\/edgedrive\.example\/dl\//);
  });

  it("resolves relative clipboard targets against location.origin at click time", () => {
    const js = viewPageClientJs();
    expect(js).toContain("new URL(");
    expect(js).toContain("location.origin");
  });
});
