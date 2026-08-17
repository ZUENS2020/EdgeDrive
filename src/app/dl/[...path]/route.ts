import { NextRequest } from "next/server";
import { getDB, getR2 } from "@/lib/cloudflare";
import {
  scheduleDownloadIncrement,
  scheduleShareDownloadIncrement,
  scheduleShareFileCountIncrement,
  shouldCountDownload,
} from "@/lib/download-count";
import { looksLikeTraversal, parseRange, sanitizeKey } from "@/lib/sanitize";
import { authorizeFileShare, getShareModeCodes, shareAllowsDownload } from "@/lib/share";
import { requestOrigin, shortSharePath } from "@/lib/share-urls";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { dlText, DL_CORS, serveR2Object } from "@/lib/serve-r2";
import { getFileByKey } from "@/lib/store";
import { publicThemeVars } from "@/lib/themes";
import { isExpired, type FileRow } from "@/lib/types";
import { parseLocale, t } from "@/lib/i18n";
import { renderViewPage } from "@/lib/view-page";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: DL_CORS });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(request, ctx, false);
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(request, ctx, true);
}

async function resolveFile(segments: string[]): Promise<{ key: string; meta: FileRow; view: boolean } | null> {
  const full = segments.join("/");
  const fullKey = sanitizeKey(full);
  if (fullKey.error || !fullKey.value) return null;
  const exact = await getFileByKey(fullKey.value);
  if (exact) return { key: fullKey.value, meta: exact, view: false };
  if (segments.length >= 2 && segments[segments.length - 1] === "view") {
    const stripped = segments.slice(0, -1).join("/");
    const keyRes = sanitizeKey(stripped);
    if (keyRes.error || !keyRes.value) return null;
    const meta = await getFileByKey(keyRes.value);
    if (meta) return { key: keyRes.value, meta, view: true };
  }
  return null;
}

function gateResponse(
  gate: { status: 404 } | { status: 410 } | { status: 302; location: string },
  gone: string,
) {
  if (gate.status === 302) {
    return new Response(null, {
      status: 302,
      headers: { Location: gate.location, ...DL_CORS },
    });
  }
  if (gate.status === 410) return dlText(gone, 410);
  return dlText("404 Not Found", 404);
}

async function handle(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
  headOnly: boolean,
) {
  if (looksLikeTraversal(request.url, request.nextUrl.pathname)) {
    return dlText("400 Bad filename: path-traversal", 400);
  }
  const { path } = await ctx.params;
  const resolved = await resolveFile(path || []);
  if (!resolved) return dlText("404 Not Found", 404);
  const { key, meta, view } = resolved;
  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // ignore
  }
  const locale = parseLocale(settings.language);
  if (isExpired(meta.expires)) {
    return dlText(t(locale, "dl.gone"), 410);
  }

  const token = request.nextUrl.searchParams.get("t");
  const db = await getDB();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const gate = await authorizeFileShare(db, {
    fileId: meta.id,
    token,
    cookieHeader: request.headers.get("cookie"),
    nextPath,
    view,
    inline: request.nextUrl.searchParams.get("inline") === "1",
    bundle: request.nextUrl.searchParams.get("bundle") === "1",
  });
  if (gate.status !== 200) return gateResponse(gate, t(locale, "dl.gone"));

  if (view) {
    const themeVars = publicThemeVars(settings.theme_name);
    const codes = await getShareModeCodes(db, gate.link.token);
    const html = renderViewPage({
      origin: requestOrigin(request),
      key,
      meta,
      theme: themeVars,
      locale,
      token: gate.link.token,
      allowDownload: shareAllowsDownload(gate.link),
      copyDownloadHref: codes.download ? shortSharePath(codes.download) : undefined,
      copyViewHref: codes.view ? shortSharePath(codes.view) : undefined,
    });
    return new Response(headOnly ? null : html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        ...DL_CORS,
      },
    });
  }

  const r2 = await getR2();
  const obj = await r2.get(key);
  if (!obj) return dlText("404 Not Found", 404);

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const rangeHeader = request.headers.get("Range");
  const range = parseRange(rangeHeader, obj.size);

  if (shouldCountDownload({ headOnly, inline, range })) {
    await scheduleDownloadIncrement(meta.id);
    if (gate.countShare) await scheduleShareDownloadIncrement(gate.link.token);
    if (gate.countBatchFile) await scheduleShareFileCountIncrement(gate.link.token, meta.id);
  }

  return serveR2Object({
    r2,
    obj,
    key,
    meta,
    inline,
    rangeHeader,
    headOnly,
  });
}
