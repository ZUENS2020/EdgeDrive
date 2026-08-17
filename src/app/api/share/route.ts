import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB } from "@/lib/cloudflare";
import { createShare, isShareKind, listShareLinks, type ShareStatus } from "@/lib/share";

export const dynamic = "force-dynamic";

const STATUSES = new Set<ShareStatus>(["active", "revoked", "expired", "exhausted"]);

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const kindRaw = url.searchParams.get("kind");
  const statusRaw = url.searchParams.get("status");
  const q = url.searchParams.get("q") || undefined;
  const kind = isShareKind(kindRaw) ? kindRaw : undefined;
  const status = statusRaw && STATUSES.has(statusRaw as ShareStatus) ? (statusRaw as ShareStatus) : undefined;
  const db = await getDB();
  const links = await listShareLinks(db, { q, kind, status });
  return NextResponse.json({ links, total: links.length });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const db = await getDB();
  const result = await createShare(db, (body || {}) as Record<string, unknown>);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    token: result.token,
    kind: result.kind,
    url: result.url,
    viewUrl: result.viewUrl,
    downloadUrl: result.downloadUrl,
    previewUrl: result.kind === "batch" ? result.url : result.viewUrl,
    shortUrl: result.shortUrl,
    shortCode: result.shortCode,
    count: result.count,
    expiresAt: result.expiresAt,
    reused: result.reused,
    hasPassword: result.hasPassword,
    allowDownload: result.allowDownload,
    allowPreview: result.allowPreview,
  });
}
