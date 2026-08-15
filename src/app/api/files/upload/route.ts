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
  await upsertFile({
    id: crypto.randomUUID(),
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
    key,
    url: `/dl/${key.split("/").map(encodeURIComponent).join("/")}`,
    expires: parsed.value,
  });
}
