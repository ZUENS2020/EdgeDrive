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
