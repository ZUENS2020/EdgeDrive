import { isInlineSafe } from "./format";
import { guessMime, parseRange } from "./sanitize";
import type { FileRow } from "./types";

export const DL_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Content-Disposition, ETag, Accept-Ranges",
  "Access-Control-Max-Age": "86400",
};

export function dlText(body: string, status: number, extra?: Record<string, string>) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...DL_CORS,
      ...extra,
    },
  });
}

export async function serveR2Object(opts: {
  r2: R2Bucket;
  obj: R2ObjectBody;
  key: string;
  meta: FileRow;
  inline: boolean;
  rangeHeader: string | null;
  headOnly: boolean;
}): Promise<Response> {
  const { obj, key, meta, inline, rangeHeader, headOnly, r2 } = opts;
  let ct = obj.httpMetadata?.contentType || meta.mime || guessMime(key) || "application/octet-stream";
  if (/html|xhtml|svg|xml|javascript|ecmascript/i.test(ct)) ct = "application/octet-stream";

  const filename = key.split("/").pop() || "download";
  const disposition =
    inline && isInlineSafe(filename, ct)
      ? `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

  const headers: Record<string, string> = {
    ...DL_CORS,
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

  const range = parseRange(rangeHeader, obj.size);
  if (rangeHeader && !range) {
    return new Response("416 Range Not Satisfiable", {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${obj.size}` },
    });
  }

  if (range) {
    const part = await r2.get(key, { range: { offset: range.start, length: range.length } });
    if (!part) return dlText("404 Not Found", 404);
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${obj.size}`;
    headers["Content-Length"] = String(range.length);
    if (headOnly) return new Response(null, { status: 206, headers });
    return new Response(part.body, { status: 206, headers });
  }

  headers["Content-Length"] = String(obj.size);
  if (headOnly) return new Response(null, { status: 200, headers });
  return new Response(obj.body, { status: 200, headers });
}
