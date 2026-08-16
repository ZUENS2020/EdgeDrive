import { sanitizeFileName, sanitizeKey, splitKey } from "./sanitize";
import { normalizeSha256 } from "./sha256";

export function parseInstantCheckBody(body: unknown): {
  sha256: string;
  name: string;
  path: string;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid json" };
  const o = body as Record<string, unknown>;
  const sha256 = normalizeSha256(o.sha256);
  if (!sha256) return { error: "bad-sha256" };
  const nameRaw = typeof o.name === "string" ? o.name : "";
  const pathRaw = typeof o.path === "string" ? o.path : "";
  const name = sanitizeFileName(nameRaw);
  if (name.error || !name.value) return { error: name.error || "bad-filename" };
  let folder = "";
  if (pathRaw) {
    const key = sanitizeKey(pathRaw);
    if (key.error || !key.value) return { error: key.error || "bad-path" };
    folder = key.value;
  }
  const full = sanitizeKey(folder ? `${folder}/${name.value}` : name.value);
  if (full.error || !full.value) return { error: full.error || "bad-filename" };
  const parts = splitKey(full.value);
  return { sha256, name: parts.name, path: parts.path };
}
