import { NextRequest } from "next/server";
import { getR2 } from "@/lib/cloudflare";
import { scheduleDownloadIncrement, shouldCountDownload } from "@/lib/download-count";
import { guessMime, looksLikeTraversal, parseRange, sanitizeKey } from "@/lib/sanitize";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { getFileByKey } from "@/lib/store";
import { publicThemeVars } from "@/lib/themes";
import { isExpired, type FileRow } from "@/lib/types";
import { isInlineSafe, renderViewPage } from "@/lib/view-page";

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
    const themeVars = publicThemeVars(settings.theme_name);
    const html = renderViewPage({ origin: request.nextUrl.origin, key, meta, theme: themeVars });
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
