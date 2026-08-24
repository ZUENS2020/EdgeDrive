import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB, getR2 } from "@/lib/cloudflare";
import { bearerMatches, cronAllowsSessionAuth } from "@/lib/cron-auth";
import { flushPendingBlobs, purgeFiles } from "@/server/v2/files";
import { readSettings } from "@/server/v2/settings";
import { cleanupUploadSessions } from "@/server/v2/uploads";

export const dynamic = "force-dynamic";

async function authorized(request: Request, secret: string): Promise<boolean> {
  if (bearerMatches(request.headers.get("authorization"), secret)) return true;
  if (!cronAllowsSessionAuth(request.method)) return false;
  return (await requireAdmin(request)).ok;
}

async function runPurge(request: Request) {
  const [db, r2] = await Promise.all([getDB(), getR2()]);
  const settings = await readSettings(db);
  const row = await db.prepare("SELECT cron_secret FROM app_settings WHERE id = 1").first<{ cron_secret: string }>();
  if (!(await authorized(request, row?.cron_secret || ""))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = Date.now();
  const expiredBefore = new Date(now - settings.expiredRetentionDays * 86400_000).toISOString();
  const trashBefore = new Date(now - settings.trashRetentionDays * 86400_000).toISOString();
  const rows = await db.prepare(`SELECT id FROM files WHERE
    (expires_at IS NOT NULL AND expires_at < ?) OR (deleted_at IS NOT NULL AND deleted_at < ?) LIMIT 100`)
    .bind(expiredBefore, trashBefore)
    .all<{ id: string }>();
  const ids = (rows.results || []).map((item) => item.id);
  const files = ids.length ? await purgeFiles(db, r2, ids) : { affected: 0 };
  const [blobs, uploads] = await Promise.all([flushPendingBlobs(db, r2), cleanupUploadSessions(db, r2)]);
  return NextResponse.json({ data: { files: files.affected, blobs, uploads } });
}

export async function GET(request: Request) {
  return runPurge(request);
}

export async function POST(request: Request) {
  return runPurge(request);
}
