import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { parseLocale } from "@/lib/i18n";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { adminFileContentPath, adminFileViewPath, withSearch } from "@/lib/share-urls";
import { getFileById } from "@/lib/store";
import { publicThemeVars } from "@/lib/themes";
import { fileKey, isExpired } from "@/lib/types";
import { renderViewPage } from "@/lib/view-page";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const meta = await getFileById(id);
  if (!meta || meta.deleted_at) {
    return new Response("404 Not Found", { status: 404 });
  }
  if (isExpired(meta.expires)) {
    return new Response("410 Gone", { status: 410 });
  }
  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // ignore
  }
  const locale = parseLocale(settings.language);
  const content = adminFileContentPath(id);
  const html = renderViewPage({
    origin: request.nextUrl.origin,
    key: fileKey(meta.path, meta.name),
    meta,
    theme: publicThemeVars(settings.theme_name),
    locale,
    downloadHref: content,
    inlineHref: withSearch(content, { inline: "1" }),
    viewHref: adminFileViewPath(id),
  });
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=30",
    },
  });
}
