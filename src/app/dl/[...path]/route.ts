import { NextRequest } from "next/server";
import { getR2 } from "@/lib/cloudflare";
import { guessMime, looksLikeTraversal, parseRange, sanitizeKey } from "@/lib/sanitize";
import { getFileByKey, incrementDownload } from "@/lib/store";
import { isExpired } from "@/lib/types";

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
  return download(request, ctx, false);
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return download(request, ctx, true);
}

async function download(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
  headOnly: boolean,
) {
  if (looksLikeTraversal(request.url, request.nextUrl.pathname)) {
    return text("400 Bad filename: path-traversal", 400);
  }
  const { path } = await ctx.params;
  const raw = (path || []).join("/");
  const keyRes = sanitizeKey(raw);
  if (keyRes.error || !keyRes.value) {
    return text("400 Bad filename: " + (keyRes.error || "empty"), 400);
  }
  const key = keyRes.value;
  const meta = await getFileByKey(key);
  if (!meta) return text("404 Not Found", 404);
  if (isExpired(meta.expires)) {
    return text("410 Gone（链接已过期）", 410);
  }

  const r2 = await getR2();
  const obj = await r2.get(key);
  if (!obj) return text("404 Not Found", 404);

  let ct = obj.httpMetadata?.contentType || meta.mime || guessMime(key) || "application/octet-stream";
  if (/html|xhtml|svg|xml|javascript|ecmascript/i.test(ct)) ct = "application/octet-stream";

  const filename = key.split("/").pop() || "download";
  const headers: Record<string, string> = {
    ...CORS,
    "Content-Type": ct,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    ETag: obj.httpEtag,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
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

  if (!headOnly && (!range || range.start === 0)) {
    await incrementDownload(meta.id);
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
