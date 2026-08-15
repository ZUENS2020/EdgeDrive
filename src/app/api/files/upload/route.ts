import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { expireFromSearchParams, parseDefaultExpires, parseExpireInput } from "@/lib/expires";
import { getSettings } from "@/lib/settings";
import { guessMime, sanitizeKey, splitKey } from "@/lib/sanitize";
import { getR2 } from "@/lib/cloudflare";
import { upsertFile } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  return upload(request);
}

export async function POST(request: Request) {
  return upload(request);
}

/** 单请求上传上限：超过请走 /api/files/mpu 分片上传（Workers 请求体上限：免费 100MB/付费 200MB）。 */
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
/** multipart/form-data 解析需全量进内存——只接受小文件；大文件走裸流直传或分片。 */
const MAX_FORM_SIZE = 10 * 1024 * 1024;

/** 落库 + 组响应（form 与裸流两个分支共用）。 */
async function saveUploaded(parts: { path: string; name: string }, size: number, mime: string, expires: string | null) {
  const id = crypto.randomUUID();
  await upsertFile({
    id,
    name: parts.name,
    path: parts.path,
    size,
    mime,
    expires,
    created_at: new Date().toISOString(),
    tags: "",
  });
  const key = parts.path ? `${parts.path}/${parts.name}` : parts.name;
  return { ok: true as const, id, key, url: `/dl/${key.split("/").map(encodeURIComponent).join("/")}`, expires };
}

async function upload(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const settings = await getSettings();
  let name = url.searchParams.get("name") || "";
  let folderPath = url.searchParams.get("path") || "";
  let mime = request.headers.get("content-type") || "";

  const keyRes = sanitizeKey(folderPath ? `${folderPath}/${name}` : name);
  if (keyRes.error || !keyRes.value) {
    return NextResponse.json({ error: keyRes.error || "bad-filename" }, { status: 400 });
  }
  const key = keyRes.value;
  const parts = splitKey(key);

  const expireInput = expireFromSearchParams(url.searchParams);
  const hasExplicit =
    expireInput.permanent ||
    expireInput.expireNow ||
    expireInput.expires ||
    expireInput.hours ||
    expireInput.days;
  const parsed = parseExpireInput(hasExplicit ? expireInput : parseDefaultExpires(settings.default_expires));
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const contentType = mime.includes("multipart/form-data") ? guessMime(parts.name) : mime || guessMime(parts.name);
  const r2 = await getR2();
  const opts: R2PutOptions = {
    httpMetadata: { contentType },
    customMetadata: parsed.value ? { expires: parsed.value } : {},
  };

  if (mime.includes("multipart/form-data")) {
    // 小文件表单上传（formData 需全量内存——限 10MB）
    const size = Number(request.headers.get("content-length") || "0");
    if (size > MAX_FORM_SIZE) {
      return NextResponse.json(
        { error: "form-too-large", max: MAX_FORM_SIZE, hint: "use-stream-or-multipart-upload" },
        { status: 413 },
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "need file" }, { status: 400 });
    }
    name = (form.get("name") as string) || file.name;
    folderPath = (form.get("path") as string) || folderPath;
    if (file.size > MAX_FORM_SIZE) {
      return NextResponse.json(
        { error: "form-too-large", max: MAX_FORM_SIZE, hint: "use-stream-or-multipart-upload" },
        { status: 413 },
      );
    }
    // 表单里可能覆盖 name/path——重新计算 key（不能用 query 算出的旧值）
    const formKeyRes = sanitizeKey(folderPath ? `${folderPath}/${name}` : name);
    if (formKeyRes.error || !formKeyRes.value) {
      return NextResponse.json({ error: formKeyRes.error || "bad-filename" }, { status: 400 });
    }
    const formParts = splitKey(formKeyRes.value);
    const formKey = formKeyRes.value;
    try {
      await r2.put(formKey, file.stream(), { ...opts, httpMetadata: { contentType: guessMime(formParts.name) } });
    } catch (err) {
      await r2.delete(formKey).catch(() => {});
      return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
    }
    const head = await r2.head(formKey);
    return NextResponse.json(await saveUploaded(formParts, head?.size || file.size, guessMime(formParts.name), parsed.value));
  }

  // 裸流直传：R2 直接吃 ReadableStream——内存 O(1)——不 OOM
  if (!request.body) return NextResponse.json({ error: "empty body" }, { status: 400 });
  const cl = Number(request.headers.get("content-length") || "0");
  if (cl > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "file-too-large", max: MAX_UPLOAD_SIZE, hint: "use-multipart-upload" },
      { status: 413 },
    );
  }
  try {
    await r2.put(key, request.body, opts);
  } catch (err) {
    await r2.delete(key).catch(() => {});
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
  const head = await r2.head(key);
  if (!head || head.size === 0) {
    await r2.delete(key).catch(() => {});
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }
  return NextResponse.json(await saveUploaded(parts, head.size, contentType, parsed.value));
}
