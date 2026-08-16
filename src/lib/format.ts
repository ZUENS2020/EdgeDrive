export function formatSize(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fileExpiryLabel(expires: string | null, now = Date.now()): string {
  if (!expires) return "永久";
  const t = new Date(expires).getTime();
  if (Number.isFinite(t) && t < now) return "已过期";
  return `有效期至 ${formatTime(expires)}`;
}

export function extLabel(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return (ext || "file").slice(0, 4);
}

export type FileKind = "img" | "vid" | "zip" | "doc" | "pdf" | "md" | "txt" | "audio" | "";

export function fileKind(name: string, mime?: string | null): FileKind {
  const m = (mime || "").toLowerCase();
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "img";
  if (m.startsWith("video/") || ["mp4", "webm", "mkv", "mov"].includes(ext)) return "vid";
  if (m.startsWith("audio/") || ["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(ext)) return "audio";
  if (["zip", "gz", "tar", "7z", "rar"].includes(ext)) return "zip";
  if (ext === "pdf" || m.includes("pdf")) return "pdf";
  if (ext === "md" || ext === "markdown" || m.includes("markdown")) return "md";
  if (ext === "txt" || m.startsWith("text/plain")) return "txt";
  if (["doc", "docx", "csv", "json"].includes(ext) || (m.startsWith("text/") && !/html|xml|javascript/.test(m))) {
    return "doc";
  }
  return "";
}

export type PreviewKind = "img" | "vid" | "audio" | "pdf" | "md" | "txt" | "none";

export function previewKind(name: string, mime?: string | null): PreviewKind {
  const kind = fileKind(name, mime);
  if (kind === "img" || kind === "vid" || kind === "audio" || kind === "pdf" || kind === "md" || kind === "txt") {
    return kind;
  }
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["json", "csv", "yaml", "yml", "toml", "log", "ini", "conf"].includes(ext)) return "txt";
  const m = (mime || "").toLowerCase();
  if (m.startsWith("text/") && !/html|xml|javascript|ecmascript/.test(m)) return "txt";
  return "none";
}

export function isInlineSafe(name: string, mime: string | null): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith(".svg") || /html|xhtml|svg|xml|javascript|ecmascript/i.test(mime || "")) {
    return false;
  }
  const kind = previewKind(name, mime);
  return kind !== "none";
}
