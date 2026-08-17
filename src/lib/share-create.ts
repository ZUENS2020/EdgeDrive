import { parseExpireInput } from "./expires";

export type ShareExpireMode = "none" | "dur" | "until" | "perm";

export type ShareCreateInput = {
  ids: string[];
  allowDownload: boolean;
  allowPreview: boolean;
  password?: string;
  maxDownloads?: string;
  expireMode?: ShareExpireMode;
  expireN?: string;
  expireUnit?: "hours" | "days";
  expireUntil?: string;
};

export type ShareCreateBodyErr = "need-ids" | "need-access" | "invalid-expire" | "invalid-max";

export function shareAccessValid(allowDownload: boolean, allowPreview: boolean): boolean {
  return Boolean(allowDownload || allowPreview);
}

export function buildShareAccessPatch(
  allowDownload: boolean,
  allowPreview: boolean,
): { ok: true; body: { allow_download: number; allow_preview: number } } | { ok: false; error: "need-access" } {
  if (!shareAccessValid(allowDownload, allowPreview)) return { ok: false, error: "need-access" };
  return {
    ok: true,
    body: {
      allow_download: allowDownload ? 1 : 0,
      allow_preview: allowPreview ? 1 : 0,
    },
  };
}

export function buildShareCreateBody(
  input: ShareCreateInput,
): { ok: true; body: Record<string, unknown> } | { ok: false; error: ShareCreateBodyErr } {
  const ids = [...new Set(input.ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) return { ok: false, error: "need-ids" };
  if (!shareAccessValid(input.allowDownload, input.allowPreview)) {
    return { ok: false, error: "need-access" };
  }
  const body: Record<string, unknown> = {
    kind: ids.length === 1 ? "file" : "batch",
    ids,
    allow_download: input.allowDownload ? 1 : 0,
    allow_preview: input.allowPreview ? 1 : 0,
  };
  const password = (input.password || "").trim();
  if (password) body.password = password;
  const maxRaw = (input.maxDownloads || "").trim();
  if (maxRaw) {
    const n = Number(maxRaw);
    if (!Number.isFinite(n) || n < 1) return { ok: false, error: "invalid-max" };
    body.max_downloads = Math.floor(n);
  }
  const mode = input.expireMode || "none";
  if (mode === "perm") {
    body.permanent = true;
  } else if (mode === "dur") {
    const n = Number(input.expireN);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "invalid-expire" };
    if (input.expireUnit === "days") body.days = n;
    else body.hours = n;
  } else if (mode === "until") {
    if (!input.expireUntil) return { ok: false, error: "invalid-expire" };
    const parsed = parseExpireInput({ expires: new Date(input.expireUntil).toISOString() });
    if (parsed.error || !parsed.value) return { ok: false, error: "invalid-expire" };
    body.expires = parsed.value;
  }
  return { ok: true, body };
}
