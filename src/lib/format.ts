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

export function extLabel(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return (ext || "file").slice(0, 4);
}

export function fileKind(name: string, mime?: string | null): "img" | "vid" | "zip" | "doc" | "pdf" | "" {
  const m = (mime || "").toLowerCase();
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "img";
  if (m.startsWith("video/") || ["mp4", "webm", "mkv", "mov"].includes(ext)) return "vid";
  if (["zip", "gz", "tar", "7z", "rar"].includes(ext)) return "zip";
  if (ext === "pdf" || m.includes("pdf")) return "pdf";
  if (["md", "txt", "doc", "docx", "csv", "json"].includes(ext)) return "doc";
  return "";
}
