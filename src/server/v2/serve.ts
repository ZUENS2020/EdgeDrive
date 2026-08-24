import { isInlineSafe } from "@/lib/format";
import { guessMime, parseRange } from "@/lib/sanitize";

export const PUBLIC_FILE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Disposition, ETag, Accept-Ranges",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function serveV2File(opts: {
  r2: R2Bucket;
  storageKey: string;
  name: string;
  mime: string | null;
  inline: boolean;
  rangeHeader: string | null;
  headOnly: boolean;
}): Promise<Response> {
  const object = await opts.r2.get(opts.storageKey);
  if (!object) return new Response("Not found", { status: 404, headers: PUBLIC_FILE_HEADERS });
  let contentType = object.httpMetadata?.contentType || opts.mime || guessMime(opts.name) || "application/octet-stream";
  if (/html|xhtml|svg|xml|javascript|ecmascript/i.test(contentType)) contentType = "application/octet-stream";
  const inline = opts.inline && isInlineSafe(opts.name, contentType);
  const headers: Record<string, string> = {
    ...PUBLIC_FILE_HEADERS,
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    ETag: object.httpEtag,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(opts.name)}`,
  };
  const range = parseRange(opts.rangeHeader, object.size);
  if (opts.rangeHeader && !range) {
    return new Response("Range not satisfiable", { status: 416, headers: { ...headers, "Content-Range": `bytes */${object.size}` } });
  }
  if (range) {
    const part = await opts.r2.get(opts.storageKey, { range: { offset: range.start, length: range.length } });
    if (!part) return new Response("Not found", { status: 404, headers });
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${object.size}`;
    headers["Content-Length"] = String(range.length);
    return new Response(opts.headOnly ? null : part.body, { status: 206, headers });
  }
  headers["Content-Length"] = String(object.size);
  return new Response(opts.headOnly ? null : object.body, { status: 200, headers });
}
