import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getR2 } from "@/lib/cloudflare";
import { scheduleDownloadIncrement, shouldCountDownload } from "@/lib/download-count";
import { parseRange } from "@/lib/sanitize";
import { DL_CORS, dlText, serveR2Object } from "@/lib/serve-r2";
import { getFileById } from "@/lib/store";
import { fileKey, isExpired } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: DL_CORS });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(request, ctx, false);
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(request, ctx, true);
}

async function handle(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
  headOnly: boolean,
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const meta = await getFileById(id);
  if (!meta || meta.deleted_at) return dlText("404 Not Found", 404);
  if (isExpired(meta.expires)) return dlText("410 Gone", 410);
  const key = fileKey(meta.path, meta.name);
  const r2 = await getR2();
  const obj = await r2.get(key);
  if (!obj) return dlText("404 Not Found", 404);
  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const rangeHeader = request.headers.get("Range");
  const range = parseRange(rangeHeader, obj.size);
  if (shouldCountDownload({ headOnly, inline, range })) {
    await scheduleDownloadIncrement(meta.id);
  }
  return serveR2Object({ r2, obj, key, meta, inline, rangeHeader, headOnly });
}
