import { DOWNLOAD_STAGGER_MS, downloadableFiles } from "./batch";
import { extLabel, fileExpiryLabel, fileKind, formatSize } from "./format";
import { PRODUCT_NAME, PRODUCT_SHORT, PRODUCT_TAGLINE } from "./product";
import { escapeHtml } from "./sanitize";
import type { PublicThemeVars } from "./themes";
import { dlUrl, fileKey, type FileRow } from "./types";

const KIND_LABEL: Record<ReturnType<typeof fileKind>, string> = {
  img: "图",
  vid: "视",
  zip: "包",
  pdf: "PDF",
  doc: "文",
  md: "MD",
  txt: "TXT",
  audio: "音",
  "": "文件",
};

export type RenderBatchPageOpts = {
  origin: string;
  files: FileRow[];
  expiresAt: string | null;
  autoDownload: boolean;
  theme: PublicThemeVars;
  now?: number;
};

function publicPageCss(theme: PublicThemeVars): string {
  return `:root { --brand:${escapeHtml(theme.brand)}; --bg:${escapeHtml(theme.bg)}; --text:${escapeHtml(theme.text)}; --text-3:${escapeHtml(theme.text3)}; --surface:${escapeHtml(theme.surface)}; --line:${escapeHtml(theme.line)}; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font:16px/1.5 "Noto Sans SC","PingFang SC","Hiragino Sans GB",sans-serif; }
    .wrap { max-width:720px; margin:0 auto; padding:48px 20px 64px; }
    .brand { display:flex; gap:10px; align-items:center; margin-bottom:24px; }
    .logo { min-width:28px; height:28px; padding:0 6px; border-radius:6px; background:var(--brand); color:#fff; display:grid; place-items:center; font-weight:600; font-size:10px; letter-spacing:.06em; }
    h1 { font-size:22px; font-weight:600; letter-spacing:-.03em; margin:0 0 8px; word-break:break-all; }
    .meta { color:var(--text-3); font-size:14px; margin:0 0 20px; }
    .banner { margin:0 0 16px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--surface); color:var(--text-3); font-size:13px; }
    .actions { display:flex; gap:8px; flex-wrap:wrap; margin:0 0 20px; }
    a.btn, button.btn { display:inline-flex; align-items:center; height:32px; padding:0 12px; background:var(--brand); color:#fff; text-decoration:none; border:0; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; font-family:inherit; }
    a.btn.ghost, button.btn.ghost { background:transparent; color:var(--text); border:1px solid var(--line); }
    .list { display:flex; flex-direction:column; gap:8px; }
    .row { display:flex; gap:12px; align-items:center; padding:12px; border:1px solid var(--line); border-radius:8px; background:var(--surface); }
    .kind { width:40px; height:40px; border-radius:8px; border:1px solid var(--line); display:grid; place-items:center; font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--text-3); flex-shrink:0; }
    .info { flex:1; min-width:0; }
    .name { font-weight:600; word-break:break-all; }
    .sub { color:var(--text-3); font-size:13px; margin-top:2px; }
    .row-actions { display:flex; gap:6px; flex-shrink:0; flex-wrap:wrap; }
    .empty { color:var(--text-3); font-size:14px; padding:12px 0; }
    .footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line); display:flex; gap:14px; align-items:center; }
    .footer a { color:var(--text-3); text-decoration:none; font-size:13px; }
    .footer a:hover { color:var(--brand); }`;
}

function fileKindLabel(name: string, mime: string | null): string {
  const kind = fileKind(name, mime);
  return KIND_LABEL[kind] || extLabel(name);
}

export function renderBatchPage(opts: RenderBatchPageOpts): string {
  const now = opts.now ?? Date.now();
  const files = opts.files;
  const payload = JSON.stringify(downloadableFiles(files, opts.origin, now)).replace(/</g, "\\u003c");
  const batchStatus = fileExpiryLabel(opts.expiresAt, now);
  const rows = files
    .map((file) => {
      const key = fileKey(file.path, file.name);
      const preview = dlUrl(opts.origin, key, true);
      const download = dlUrl(opts.origin, key);
      return `<div class="row">
      <div class="kind">${escapeHtml(fileKindLabel(file.name, file.mime))}</div>
      <div class="info">
        <div class="name">${escapeHtml(file.name)}</div>
        <div class="sub">${escapeHtml(formatSize(file.size))} · ${escapeHtml(fileExpiryLabel(file.expires, now))}${file.path ? ` · ${escapeHtml(file.path)}` : ""}</div>
      </div>
      <div class="row-actions">
        <a class="btn ghost" href="${escapeHtml(preview)}">预览</a>
        <a class="btn" href="${escapeHtml(download)}" download="${escapeHtml(file.name)}">下载</a>
      </div>
    </div>`;
    })
    .join("\n");

  const banner = opts.autoDownload
    ? `<p class="banner">如被拦截请点下方「全部下载」或允许浏览器下载</p>`
    : "";

  const list =
    files.length === 0
      ? `<p class="empty">这些文件已被删除。</p>`
      : `<div class="list">${rows}</div>`;

  const autoJs = opts.autoDownload
    ? `window.addEventListener("DOMContentLoaded", function () { triggerDownloads(FILES); });`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${files.length} 个文件 · ${escapeHtml(PRODUCT_NAME)}</title>
  <style>
    ${publicPageCss(opts.theme)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="logo">${escapeHtml(PRODUCT_SHORT)}</div>
      <div>${escapeHtml(PRODUCT_NAME)}</div>
    </div>
    <h1>${files.length} 个文件</h1>
    <p class="meta">${escapeHtml(batchStatus)}</p>
    ${banner}
    <div class="actions">
      <button type="button" class="btn" id="download-all">全部下载</button>
    </div>
    ${list}
    <div class="footer">
      <span style="color:var(--text-3);font-size:13px">${escapeHtml(PRODUCT_NAME)} · ${escapeHtml(PRODUCT_TAGLINE)}</span>
      <a href="https://github.com/ZUENS2020/edgedrive" target="_blank" rel="noopener">GitHub</a>
    </div>
  </div>
  <script>
    (function () {
      var FILES = ${payload};
      var GAP = ${DOWNLOAD_STAGGER_MS};
      function triggerDownloads(files) {
        files.forEach(function (f, i) {
          setTimeout(function () {
            var a = document.createElement("a");
            a.href = f.url;
            a.setAttribute("download", f.name);
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
          }, i * GAP);
        });
      }
      var btn = document.getElementById("download-all");
      if (btn) btn.addEventListener("click", function () { triggerDownloads(FILES); });
      ${autoJs}
    })();
  </script>
</body>
</html>`;
}
