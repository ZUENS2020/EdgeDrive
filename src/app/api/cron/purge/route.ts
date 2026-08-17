import { NextResponse } from "next/server";
import { getKv, KV } from "@/lib/app-config";
import { requireAdmin } from "@/lib/auth-guard";
import { deleteExpiredBatches } from "@/lib/batch";
import { getDB } from "@/lib/cloudflare";
import { bearerMatches, cronAllowsSessionAuth } from "@/lib/cron-auth";
import { getSettings } from "@/lib/settings";
import { purgeExpired, purgeTrash } from "@/lib/store";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  const db = await getDB();
  const secret = await getKv(db, KV.cronSecret);
  if (bearerMatches(request.headers.get("authorization"), secret)) return true;
  // GET is used by the injected scheduled handler with Bearer only.
  // Session cookies on GET would let a logged-in admin's click purge the catalog.
  if (!cronAllowsSessionAuth(request.method)) return false;
  const gate = await requireAdmin(request);
  return gate.ok;
}

async function runPurge(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getSettings();
  const result = await purgeExpired(settings.purge_after_days);
  const trash = await purgeTrash();
  const expiredBatchLinks = await deleteExpiredBatches(await getDB());
  return NextResponse.json({
    ok: true,
    ...result,
    trashDeleted: trash.deleted,
    trashBatches: trash.batches,
    expiredBatchLinks,
    graceDays: settings.purge_after_days,
  });
}

export async function GET(request: Request) {
  return runPurge(request);
}

export async function POST(request: Request) {
  return runPurge(request);
}
