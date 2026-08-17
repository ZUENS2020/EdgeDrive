import { NextRequest } from "next/server";
import { resolveBatchPage } from "@/lib/batch";
import { renderBatchPage } from "@/lib/batch-page";
import { getDB } from "@/lib/cloudflare";
import { parseLocale, t } from "@/lib/i18n";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { evaluateShareAccess, getShareLink, sharePackOnly } from "@/lib/share";
import { DL_CORS, dlText } from "@/lib/serve-r2";
import { publicThemeVars } from "@/lib/themes";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: DL_CORS });
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
  const link = await getShareLink(db, token);
  if (!link || link.kind !== "batch") return dlText("404 Not Found", 404);

  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // ignore
  }
  const locale = parseLocale(settings.language);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const gate = await evaluateShareAccess(link, {
    cookieHeader: request.headers.get("cookie"),
    nextPath,
  });
  if (gate.status === 302) {
    return new Response(null, { status: 302, headers: { Location: gate.location, ...DL_CORS } });
  }
  if (gate.status === 410) return dlText(t(locale, "dl.gone"), 410);
  if (gate.status !== 200) return dlText("404 Not Found", 404);

  const resolved = await resolveBatchPage(db, token);
  if (resolved.status === 404) return dlText("404 Not Found", 404);
  if (resolved.status === 410) return dlText(t(locale, "dl.gone"), 410);

  const autoDownload = request.nextUrl.searchParams.get("mode") === "download";
  const html = renderBatchPage({
    origin: request.nextUrl.origin,
    files: resolved.files,
    expiresAt: resolved.batch.expires_at,
    autoDownload,
    theme: publicThemeVars(settings.theme_name),
    locale,
    token: link.token,
    packOnly: sharePackOnly(link),
  });
  return new Response(headOnly ? null : html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=30, must-revalidate",
      ...DL_CORS,
    },
  });
}
