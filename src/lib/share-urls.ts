import { encodeDlPath, fileKey } from "./types";

export function withSearch(path: string, params: Record<string, string | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") qs.set(key, value);
  }
  const q = qs.toString();
  if (!q) return path;
  return path.includes("?") ? `${path}&${q}` : `${path}?${q}`;
}

export function fileLongPath(
  file: { path: string; name: string },
  token: string,
  view = false,
): string {
  const key = fileKey(file.path, file.name);
  const base = `/dl/${encodeDlPath(key)}${view ? "/view" : ""}`;
  return withSearch(base, { t: token });
}

export function fileInlinePath(file: { path: string; name: string }, token: string): string {
  return withSearch(fileLongPath(file, token), { inline: "1" });
}

export function batchSharePaths(token: string): { previewUrl: string; downloadUrl: string } {
  const previewUrl = `/dl/batch/${encodeURIComponent(token)}`;
  return { previewUrl, downloadUrl: withSearch(previewUrl, { mode: "download" }) };
}

export function shortSharePath(code: string): string {
  return `/s/${encodeURIComponent(code)}`;
}

export function passwordPagePath(token: string, next?: string): string {
  return withSearch(`/share/${encodeURIComponent(token)}`, { next });
}

export function adminFileContentPath(id: string): string {
  return `/api/files/${encodeURIComponent(id)}/content`;
}

export function adminFileViewPath(id: string): string {
  return `/api/files/${encodeURIComponent(id)}/view`;
}

export function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function firstHeaderValue(headers: Headers, name: string): string | undefined {
  const raw = headers.get(name);
  if (!raw) return undefined;
  const first = raw.split(",")[0]?.trim();
  return first || undefined;
}

/**
 * Public origin for absolute URLs. Prefers forwarded Host/proto (Workers / reverse proxy),
 * then the Host header, then `request.url`. No env fallback — a stale APP_URL would
 * leak the wrong domain into copied links.
 */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host =
    firstHeaderValue(request.headers, "x-forwarded-host") ||
    firstHeaderValue(request.headers, "host") ||
    url.host;
  const forwarded = (firstHeaderValue(request.headers, "x-forwarded-proto") || "").toLowerCase();
  const proto =
    forwarded === "http" || forwarded === "https" ? forwarded : url.protocol.replace(/:$/, "") || "https";
  if (!host) return url.origin;
  return `${proto}://${host}`;
}

/** Join origin + path into an absolute URL. Idempotent if `path` is already http(s). */
export function originJoin(origin: string, path: string): string {
  const p = (path || "").trim();
  if (isAbsoluteHttpUrl(p)) return p;
  const base = (origin || "").trim().replace(/\/$/, "");
  if (!p) return base;
  if (!base) return p.startsWith("/") ? p : `/${p}`;
  return `${base}${p.startsWith("/") ? p : `/${p}`}`;
}

/** Clipboard / share-copy target. Same as originJoin; named for call sites that copy. */
export function absoluteCopyUrl(path: string, origin: string): string {
  return originJoin(origin, path);
}
