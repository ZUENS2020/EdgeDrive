const MAX_KEY_BYTES = 1024;

export function looksLikeTraversal(rawUrl: string, pathname: string): boolean {
  const raw = String(rawUrl || "");
  if (/%2e/i.test(raw) || /%2f/i.test(raw) || /%5c/i.test(raw)) return true;
  if (pathname.split("/").includes("..") || pathname.split("/").includes(".")) return true;
  if (/\/\.\.(\/|$)/.test(raw) || /\/\.\.(\/|$)/.test(pathname)) return true;
  return false;
}

export function decodePath(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function sanitizeKey(raw: string | null | undefined): {
  value?: string;
  error?: string;
} {
  if (raw == null) return { error: "empty" };
  let key = String(raw);
  for (let i = 0; i < 4; i++) {
    if (/%2e/i.test(key) || /%2f/i.test(key) || /%5c/i.test(key)) {
      return { error: "encoded-traversal" };
    }
    if (!/%[0-9a-fA-F]{2}/.test(key)) break;
    try {
      const next = decodeURIComponent(key);
      if (next === key) break;
      key = next;
    } catch {
      return { error: "bad-encoding" };
    }
  }
  key = key.normalize("NFC").trim();
  if (!key) return { error: "empty" };
  // R2 key 上限按 UTF-8 bytes（1024）——用字节数而不是 JS 字符数（中文/emoji 多字节）
  if (new TextEncoder().encode(key).byteLength > MAX_KEY_BYTES) return { error: "too-long" };
  if (/[\x00-\x1f\x7f]/.test(key)) return { error: "control-chars" };
  key = key.replace(/\\/g, "/");
  if (key.includes("..")) return { error: "path-traversal" };
  if (key.startsWith("/") || key.endsWith("/") || key.includes("//")) {
    return { error: "slash" };
  }
  return { value: key };
}

export function sanitizeFolderName(raw: string): { value?: string; error?: string } {
  return sanitizeName(raw, 180);
}

export function sanitizeFileName(raw: string): { value?: string; error?: string } {
  return sanitizeName(raw, 255);
}

function sanitizeName(raw: string, max: number): { value?: string; error?: string } {
  const name = raw.normalize("NFC").trim();
  if (!name) return { error: "empty" };
  if (name.length > max) return { error: "too-long" };
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return { error: "invalid-name" };
  }
  if (/[\x00-\x1f\x7f]/.test(name)) return { error: "control-chars" };
  return { value: name };
}

export function guessMime(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    json: "application/json",
    csv: "text/csv",
    pdf: "application/pdf",
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    "7z": "application/x-7z-compressed",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    html: "text/html",
    htm: "text/html",
    js: "text/javascript",
    css: "text/css",
  };
  return map[ext] || "application/octet-stream";
}

export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number; length: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  let start: number;
  let end: number;
  if (m[1] === "" && m[2] !== "") {
    const suffix = Number(m[2]);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Number(m[2]);
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }
  if (end >= size) end = size - 1;
  return { start, end, length: end - start + 1 };
}

export function splitKey(key: string): { path: string; name: string } {
  const i = key.lastIndexOf("/");
  if (i < 0) return { path: "", name: key };
  return { path: key.slice(0, i), name: key.slice(i + 1) };
}
