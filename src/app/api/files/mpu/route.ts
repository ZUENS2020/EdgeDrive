import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { expireFromSearchParams, parseDefaultExpires, parseExpireInput } from "@/lib/expires";
import { getSettings } from "@/lib/settings";
import { guessMime, sanitizeKey, splitKey } from "@/lib/sanitize";
import { getR2 } from "@/lib/cloudflare";
import { upsertFile } from "@/lib/store";

export const dynamic = "force-dynamic";

/** 单片上限：客户端 8MB；略放大防边界，拒绝把整文件当一片灌进内存。 */
const MAX_MPU_PART_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const keyRes = sanitizeKey(url.searchParams.get("key") || url.searchParams.get("name") || "");
  if (keyRes.error || !keyRes.value) {
    return NextResponse.json({ error: keyRes.error || "bad-filename" }, { status: 400 });
  }
  const key = keyRes.value;
  const r2 = await getR2();

  if (action === "create") {
    const settings = await getSettings();
    const expireInput = expireFromSearchParams(url.searchParams);
    const hasExplicit =
      expireInput.permanent ||
      expireInput.expireNow ||
      expireInput.expires ||
      expireInput.hours ||
      expireInput.days;
    const parsed = parseExpireInput(hasExplicit ? expireInput : parseDefaultExpires(settings.default_expires));
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    let contentType = request.headers.get("content-type") || guessMime(key);
    if (contentType.includes("application/json")) contentType = guessMime(key);
    const opts: R2MultipartOptions = { httpMetadata: { contentType } };
    if (parsed.value) opts.customMetadata = { expires: parsed.value };
    const mpu = await r2.createMultipartUpload(key, opts);
    return NextResponse.json({ key: mpu.key, uploadId: mpu.uploadId, expires: parsed.value });
  }

  if (action === "complete") {
    const uploadId = url.searchParams.get("uploadId");
    if (!uploadId) return NextResponse.json({ error: "need uploadId" }, { status: 400 });
    let body: { parts?: { partNumber: number; etag: string }[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "need JSON {parts}" }, { status: 400 });
    }
    const parts = (body.parts || []).slice().sort((a, b) => a.partNumber - b.partNumber);
    if (!parts.length) return NextResponse.json({ error: "empty parts" }, { status: 400 });
    const mpu = r2.resumeMultipartUpload(key, uploadId);
    try {
      const object = await mpu.complete(parts);
      const { path, name } = splitKey(key);
      const id = crypto.randomUUID();
      await upsertFile({
        id,
        name,
        path,
        size: object.size,
        mime: object.httpMetadata?.contentType || guessMime(name),
        expires: object.customMetadata?.expires || null,
        created_at: new Date().toISOString(),
        tags: "",
      });
      return NextResponse.json({
        ok: true,
        id,
        key,
        etag: object.httpEtag,
        url: `/dl/${key.split("/").map(encodeURIComponent).join("/")}`,
      });
    } catch (err) {
      return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "unknown mpu action" }, { status: 400 });
}

export async function PUT(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const keyRes = sanitizeKey(url.searchParams.get("key") || "");
  if (keyRes.error || !keyRes.value) {
    return NextResponse.json({ error: keyRes.error || "bad-filename" }, { status: 400 });
  }
  if (action !== "part") {
    return NextResponse.json({ error: "unknown mpu action" }, { status: 400 });
  }
  const uploadId = url.searchParams.get("uploadId");
  const partNumber = Number(url.searchParams.get("partNumber"));
  if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
    return NextResponse.json({ error: "need uploadId and partNumber>=1" }, { status: 400 });
  }
  const cl = Number(request.headers.get("content-length") || "0");
  if (cl > MAX_MPU_PART_SIZE) {
    return NextResponse.json({ error: "part-too-large", max: MAX_MPU_PART_SIZE }, { status: 413 });
  }
  if (!request.body) return NextResponse.json({ error: "empty body" }, { status: 400 });
  const r2 = await getR2();
  const mpu = r2.resumeMultipartUpload(keyRes.value, uploadId);
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength === 0) return NextResponse.json({ error: "empty body" }, { status: 400 });
    if (buf.byteLength > MAX_MPU_PART_SIZE) {
      return NextResponse.json({ error: "part-too-large", max: MAX_MPU_PART_SIZE }, { status: 413 });
    }
    const uploaded = await mpu.uploadPart(partNumber, buf);
    return NextResponse.json(uploaded);
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const keyRes = sanitizeKey(url.searchParams.get("key") || "");
  const uploadId = url.searchParams.get("uploadId");
  if (keyRes.error || !keyRes.value || !uploadId) {
    return NextResponse.json({ error: "need key and uploadId" }, { status: 400 });
  }
  const r2 = await getR2();
  try {
    await r2.resumeMultipartUpload(keyRes.value, uploadId).abort();
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
