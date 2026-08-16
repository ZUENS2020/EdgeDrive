import { sanitizeKey } from "./sanitize";

export type CopyItemResult = {
  id: string;
  ok: boolean;
  newId?: string;
  error?: string;
  message?: string;
};

export const COPY_ERROR_MESSAGE: Record<string, string> = {
  "file-exists": "目标文件夹已有同名文件",
  "same-path": "不能复制到自身",
  "not-found": "文件不存在",
  miss: "源文件不存在",
  "folder-not-found": "文件夹不存在",
  "need ids": "请选择文件",
  "need target_path": "请选择目标文件夹",
};

export function copyErrorMessage(code: string | undefined): string {
  if (!code) return "复制失败";
  return COPY_ERROR_MESSAGE[code] || code;
}

export function parseCopyBody(body: unknown): { ids: string[]; target_path: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid json" };
  const o = body as Record<string, unknown>;
  if (!Array.isArray(o.ids)) return { error: "need ids" };
  const ids = [...new Set(o.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
  if (!ids.length) return { error: "need ids" };
  if (typeof o.target_path !== "string") return { error: "need target_path" };
  if (!o.target_path) return { ids, target_path: "" };
  const key = sanitizeKey(o.target_path);
  if (key.error || !key.value) return { error: key.error || "bad-path" };
  return { ids, target_path: key.value };
}

export function decideCopyItem(
  src: { path: string; deleted_at?: string | null } | null,
  destPath: string,
  destHasSameName: boolean,
): "copy" | "not-found" | "same-path" | "file-exists" {
  if (!src || src.deleted_at) return "not-found";
  if (src.path === destPath) return "same-path";
  if (destHasSameName) return "file-exists";
  return "copy";
}

/** HTTP status: any success → 200; all name clashes → 409; otherwise 400. */
export function copyResponseStatus(copied: number, results: CopyItemResult[]): number {
  if (copied > 0) return 200;
  const errors = results.filter((r) => !r.ok).map((r) => r.error);
  if (errors.length && errors.every((e) => e === "file-exists")) return 409;
  return 400;
}

export function withCopyMessages(results: CopyItemResult[]): CopyItemResult[] {
  return results.map((r) => (r.ok ? r : { ...r, message: copyErrorMessage(r.error) }));
}
