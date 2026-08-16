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

export function originJoin(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
