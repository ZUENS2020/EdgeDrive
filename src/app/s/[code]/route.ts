import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare";
import { parseLocale, t } from "@/lib/i18n";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { getShareLinkByShortCode, longPathForShare, shareStatus } from "@/lib/share";
import { DL_CORS, dlText } from "@/lib/serve-r2";
import { isShortCode } from "@/lib/share-token";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: DL_CORS });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  return handle(request, ctx);
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  return handle(request, ctx);
}

async function handle(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  void request;
  const { code } = await ctx.params;
  if (!isShortCode(code || "")) return dlText("404 Not Found", 404);
  const db = await getDB();
  const link = await getShareLinkByShortCode(db, code);
  if (!link) return dlText("404 Not Found", 404);
  let locale = parseLocale(DEFAULTS.language);
  try {
    locale = parseLocale((await getSettings()).language);
  } catch {
    // ignore
  }
  const status = shareStatus(link);
  if (status !== "active") return dlText(t(locale, "dl.gone"), 410);
  const location = await longPathForShare(db, link);
  return new Response(null, {
    status: 302,
    headers: { Location: location, ...DL_CORS },
  });
}
