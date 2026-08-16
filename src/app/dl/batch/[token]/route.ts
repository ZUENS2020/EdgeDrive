import { NextRequest } from "next/server";
import { resolveBatchPage } from "@/lib/batch";
import { renderBatchPage } from "@/lib/batch-page";
import { getDB } from "@/lib/cloudflare";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { publicThemeVars } from "@/lib/themes";

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...CORS,
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  return handle(request, ctx, false);
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  return handle(request, ctx, true);
}

async function handle(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
  headOnly: boolean,
) {
  const { token } = await ctx.params;
  const db = await getDB();
  const resolved = await resolveBatchPage(db, token);
  if (resolved.status === 404) return text("404 Not Found", 404);
  if (resolved.status === 410) return text("410 Gone（链接已过期）", 410);

  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // ignore
  }
  const autoDownload = request.nextUrl.searchParams.get("mode") === "download";
  const html = renderBatchPage({
    origin: request.nextUrl.origin,
    files: resolved.files,
    expiresAt: resolved.batch.expires_at,
    autoDownload,
    theme: publicThemeVars(settings.theme_name),
  });
  return new Response(headOnly ? null : html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=30, must-revalidate",
      ...CORS,
    },
  });
}
