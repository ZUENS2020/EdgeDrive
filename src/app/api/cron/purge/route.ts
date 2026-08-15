import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { requireAdmin } from "@/lib/auth-guard";
import { getKv, KV } from "@/lib/app-config";
import { getDB } from "@/lib/cloudflare";
import { getSettings } from "@/lib/settings";
import { purgeExpired } from "@/lib/store";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  const db = await getDB();
  const secret = await getKv(db, KV.cronSecret);
  if (bearerMatches(request.headers.get("authorization"), secret)) return true;
  const gate = await requireAdmin(request);
  return gate.ok;
}

async function runPurge(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getSettings();
  const result = await purgeExpired(settings.purge_after_days);
  return NextResponse.json({ ok: true, ...result, graceDays: settings.purge_after_days });
}

export async function GET(request: Request) {
  return runPurge(request);
}

export async function POST(request: Request) {
  return runPurge(request);
}
