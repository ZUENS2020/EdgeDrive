import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare";
import { parseLocale, t } from "@/lib/i18n";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { resolveShortShareRedirect } from "@/lib/share";
import { DL_CORS, dlText } from "@/lib/serve-r2";

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
  const db = await getDB();
  const result = await resolveShortShareRedirect(db, code || "");
  if (result.status === 404) return dlText("404 Not Found", 404);
  if (result.status === 410) {
    let locale = parseLocale(DEFAULTS.language);
    try {
      locale = parseLocale((await getSettings()).language);
    } catch {
      // ignore
    }
    return dlText(t(locale, "dl.gone"), 410);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: result.location, ...DL_CORS },
  });
}
