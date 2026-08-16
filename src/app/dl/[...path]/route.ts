import { NextRequest } from "next/server";
import { getR2 } from "@/lib/cloudflare";
import { PRODUCT_NAME, PRODUCT_SHORT, PRODUCT_TAGLINE } from "@/lib/product";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { resolveThemePalette } from "@/lib/themes";
import { fileKind, formatSize, formatTime } from "@/lib/format";
import { guessMime, looksLikeTraversal, parseRange, sanitizeKey } from "@/lib/sanitize";
import { scheduleDownloadIncrement, shouldCountDownload } from "@/lib/download-count";
import { getFileByKey } from "@/lib/store";
import { isExpired, type FileRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Content-Disposition, ETag, Accept-Ranges",
  "Access-Control-Max-Age": "86400",
};

function text(body: string, status: number, extra?: Record<string, string>) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...CORS,
      ...extra,
    },
  });
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(request, ctx, false);
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(request, ctx, true);
}

function isInlineSafe(name: string, mime: string | null) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".svg") || /html|xhtml|svg|xml|javascript|ecmascript/i.test(mime || "")) {
    return false;
  }
  const kind = fileKind(name, mime);
  if (kind === "img" || kind === "vid" || kind === "pdf") return true;
  const m = (mime || "").toLowerCase();
  return m.startsWith("audio/") || m.startsWith("image/") || m.startsWith("video/");
}

async function resolveFile(segments: string[]): Promise<{ key: string; meta: FileRow; view: boolean } | null> {
  const full = segments.join("/");
  const fullKey = sanitizeKey(full);
  if (fullKey.error || !fullKey.value) return null;
  const exact = await getFileByKey(fullKey.value);
  if (exact) return { key: fullKey.value, meta: exact, view: false };
  if (segments.length >= 2 && segments[segments.length - 1] === "view") {
    const stripped = segments.slice(0, -1).join("/");
    const keyRes = sanitizeKey(stripped);
    if (keyRes.error || !keyRes.value) return null;
    const meta = await getFileByKey(keyRes.value);
    if (meta) return { key: keyRes.value, meta, view: true };
  }
  return null;
}

async function handle(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
  headOnly: boolean,
) {
  if (looksLikeTraversal(request.url, request.nextUrl.pathname)) {
    return text("400 Bad filename: path-traversal", 400);
  }
  const { path } = await ctx.params;
  const resolved = await resolveFile(path || []);
  if (!resolved) return text("404 Not Found", 404);
  const { key, meta, view } = resolved;
  if (isExpired(meta.expires)) {
    return text("410 Gone（链接已过期）", 410);
  }

  if (view) {
    let settings = DEFAULTS;
    try {
      settings = await getSettings();
    } catch {
      // ignore
    }
    const palette = resolveThemePalette(settings.theme_name);
    const p = palette as unknown as {
      primary: { main: string };
      background: { default: string; paper: string };
      text: { primary: string; secondary: string };
      divider: string;
    };
    const themeVars = {
      brand: p.primary.main,
      bg: p.background.default,
      text: p.text.primary,
      text3: p.text.secondary,
      surface: p.background.paper,
      line: p.divider,
    };
    const html = renderViewPage(request.nextUrl.origin, key, meta, themeVars);
    return new Response(headOnly ? null : html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=30, must-revalidate",
        ...CORS,
      },
    });
  }

  const r2 = await getR2();
  const obj = await r2.get(key);
  if (!obj) return text("404 Not Found", 404);

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  let ct = obj.httpMetadata?.contentType || meta.mime || guessMime(key) || "application/octet-stream";
  if (/html|xhtml|svg|xml|javascript|ecmascript/i.test(ct)) ct = "application/octet-stream";

  const filename = key.split("/").pop() || "download";
  const disposition =
    inline && isInlineSafe(filename, ct)
      ? `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

  const headers: Record<string, string> = {
    ...CORS,
    "Content-Type": ct,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    ETag: obj.httpEtag,
    "Content-Disposition": disposition,
  };
  if (meta.expires) {
    const ttl = Math.max(0, Math.floor((new Date(meta.expires).getTime() - Date.now()) / 1000));
    headers["Cache-Control"] = `public, max-age=${Math.min(60, ttl)}, must-revalidate`;
  } else {
    headers["Cache-Control"] = "public, max-age=300";
  }

  const rangeHeader = request.headers.get("Range");
  const range = parseRange(rangeHeader, obj.size);
  if (rangeHeader && !range) {
    return new Response("416 Range Not Satisfiable", {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${obj.size}` },
    });
  }

  if (shouldCountDownload({ headOnly, inline, range })) {
    await scheduleDownloadIncrement(meta.id);
  }

  if (range) {
    const part = await r2.get(key, { range: { offset: range.start, length: range.length } });
    if (!part) return text("404 Not Found", 404);
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${obj.size}`;
    headers["Content-Length"] = String(range.length);
    if (headOnly) return new Response(null, { status: 206, headers });
    return new Response(part.body, { status: 206, headers });
  }

  headers["Content-Length"] = String(obj.size);
  if (headOnly) return new Response(null, { status: 200, headers });
  return new Response(obj.body, { status: 200, headers });
}

function renderViewPage(
  origin: string,
  key: string,
  meta: FileRow,
  themeVars?: { brand: string; bg: string; text: string; text3: string; surface: string; line: string },
) {
  const dl = `${origin}/dl/${key.split("/").map(encodeURIComponent).join("/")}`;
  const inline = `${dl}?inline=1`;
  const kind = fileKind(meta.name, meta.mime);
  const safeInline = isInlineSafe(meta.name, meta.mime);
  const status = meta.expires
    ? isExpired(meta.expires)
      ? "已过期"
      : `有效期至 ${formatTime(meta.expires)}`
    : "永久";
  let embed = "";
  if (safeInline && kind === "img") {
    embed = `<img class="preview" src="${esc(inline)}" alt="${esc(meta.name)}">`;
  } else if (safeInline && kind === "vid") {
    embed = `<video class="preview" controls src="${esc(inline)}"></video>`;
  } else if (safeInline && (meta.mime || "").startsWith("audio/")) {
    embed = `<audio controls src="${esc(inline)}"></audio>`;
  } else if (safeInline && kind === "pdf") {
    embed = `<iframe class="preview pdf" src="${esc(inline)}" title="${esc(meta.name)}"></iframe>`;
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(meta.name)} · ${esc(PRODUCT_NAME)}</title>
  <style>
    :root { --brand:${esc(themeVars?.brand ?? "#171717")}; --bg:${esc(themeVars?.bg ?? "#f6f5f2")}; --text:${esc(themeVars?.text ?? "#171717")}; --text-3:${esc(themeVars?.text3 ?? "#737373")}; --surface:${esc(themeVars?.surface ?? "#fff")}; --line:${esc(themeVars?.line ?? "rgba(23,23,23,.1)")}; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font:16px/1.5 "Noto Sans SC","PingFang SC","Hiragino Sans GB",sans-serif; }
    .wrap { max-width:720px; margin:0 auto; padding:48px 20px 64px; }
    .brand { display:flex; gap:10px; align-items:center; margin-bottom:24px; }
    .logo { min-width:28px; height:28px; padding:0 6px; border-radius:6px; background:var(--brand); color:#fff; display:grid; place-items:center; font-weight:600; font-size:10px; letter-spacing:.06em; }
    h1 { font-size:22px; font-weight:600; letter-spacing:-.03em; margin:0 0 8px; word-break:break-all; }
    .meta { color:var(--text-3); font-size:14px; margin:0 0 20px; }
    a.btn { display:inline-flex; align-items:center; height:32px; padding:0 12px; background:var(--brand); color:#fff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:500; }
    .preview { max-width:100%; border:1px solid var(--line); border-radius:8px; background:var(--surface); margin:0 0 20px; }
    iframe.pdf { width:100%; height:70vh; }
    audio { width:100%; margin:0 0 20px; }
    .footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line); display:flex; gap:14px; align-items:center; }
    .footer a { color:var(--text-3); text-decoration:none; font-size:13px; }
    .footer a:hover { color:var(--brand); }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="logo">${esc(PRODUCT_SHORT)}</div>
      <div>${esc(PRODUCT_NAME)}</div>
    </div>
    <h1>${esc(meta.name)}</h1>
    <p class="meta">${esc(formatSize(meta.size))} · ${esc(status)}${meta.path ? ` · ${esc(meta.path)}` : ""}</p>
    ${embed}
    <p><a class="btn" href="${esc(dl)}">下载</a></p>
    <div class="footer">
      <span style="color:var(--text-3);font-size:13px">${esc(PRODUCT_NAME)} · ${esc(PRODUCT_TAGLINE)}</span>
      <a href="https://github.com/ZUENS2020/edgedrive" target="_blank" rel="noopener">GitHub</a>
    </div>
  </div>
</body>
</html>`;
}
