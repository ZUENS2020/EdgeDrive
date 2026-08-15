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

/** 单次请求上传上限：超过请走 /api/files/mpu 分片上传（100MB 为 Workers 请求体上限）。 */
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

async function upload(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const settings = await getSettings();
  let name = url.searchParams.get("name") || "";
  let folderPath = url.searchParams.get("path") || "";
  let body: ArrayBuffer | null = null;
  let mime = request.headers.get("content-type") || "";
  let size = Number(request.headers.get("content-length") || "0");

  // 有 content-length 先查（读取前拦截大请求）
  if (size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "file-too-large", max: MAX_UPLOAD_SIZE, hint: "use-multipart-upload" },
      { status: 413 },
    );
  }

  if (mime.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "need file" }, { status: 400 });
    }
    name = (form.get("name") as string) || file.name;
    folderPath = (form.get("path") as string) || folderPath;
    body = await file.arrayBuffer();
    mime = file.type || guessMime(name);
    size = file.size;
  } else {
    body = await request.arrayBuffer();
    size = body.byteLength;
  }

  const keyRes = sanitizeKey(folderPath ? `${folderPath}/${name}` : name);
  if (keyRes.error || !keyRes.value) {
    return NextResponse.json({ error: keyRes.error || "bad-filename" }, { status: 400 });
  }
  const key = keyRes.value;
  const parts = splitKey(key);
  if (!body || body.byteLength === 0) return NextResponse.json({ error: "empty body" }, { status: 400 });
  // 读取后复查（multipart/无 content-length 时兜底）
  if (body.byteLength > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "file-too-large", max: MAX_UPLOAD_SIZE, hint: "use-multipart-upload" },
      { status: 413 },
    );
  }

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
  try {
    await r2.put(key, body, {
      httpMetadata: { contentType },
      customMetadata: parsed.value ? { expires: parsed.value } : {},
    });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 500 });
  }
  const head = await r2.head(key);
  const id = crypto.randomUUID();
  await upsertFile({
    id,
    name: parts.name,
    path: parts.path,
    size: head?.size || size,
    mime: contentType,
    expires: parsed.value,
    created_at: new Date().toISOString(),
    tags: "",
  });
  return NextResponse.json({
    ok: true,
    id,
    key,
    url: `/dl/${key.split("/").map(encodeURIComponent).join("/")}`,
    expires: parsed.value,
  });
}
