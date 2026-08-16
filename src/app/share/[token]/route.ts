import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare";
import { parseLocale } from "@/lib/i18n";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { getShareLink, longPathForShare, shareCookieUnlocked, shareStatus } from "@/lib/share";
import { renderPasswordPage, type PasswordPageState } from "@/lib/share-page";
import { safeShareNext } from "@/lib/share-password";
import { publicThemeVars } from "@/lib/themes";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const db = await getDB();
  const link = await getShareLink(db, token);
  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // ignore
  }
  const locale = parseLocale(settings.language);
  const theme = publicThemeVars(settings.theme_name);
  const fallback = link ? await longPathForShare(db, link) : "/";
  const next = safeShareNext(request.nextUrl.searchParams.get("next"), fallback);

  if (!link) {
    return html(
      renderPasswordPage({ token, next, theme, locale, state: "gone" }),
      404,
    );
  }
  const status = shareStatus(link);
  if (status !== "active") {
    return html(renderPasswordPage({ token, next, theme, locale, state: "gone" }), 410);
  }
  if (!link.password_hash || (await shareCookieUnlocked(link, request.headers.get("cookie")))) {
    return new Response(null, { status: 302, headers: { Location: next } });
  }

  const err = request.nextUrl.searchParams.get("e");
  let state: PasswordPageState = "form";
  let minutes: number | undefined;
  if (err === "wrong") state = "wrong";
  else if (err === "locked") {
    state = "locked";
    const raw = request.nextUrl.searchParams.get("m");
    const n = Number(raw);
    minutes = Number.isFinite(n) && n > 0 ? n : 10;
  } else if (err === "missing") state = "missing";

  return html(renderPasswordPage({ token, next, theme, locale, state, minutes }), 200);
}

function html(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
