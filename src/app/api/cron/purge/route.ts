import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { envString, getCfEnv } from "@/lib/cloudflare";
import { getSettings } from "@/lib/settings";
import { purgeExpired } from "@/lib/store";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  const env = await getCfEnv();
  const secret = envString(env, "CRON_SECRET");
  const header = request.headers.get("authorization") || "";
  if (secret && header === `Bearer ${secret}`) return true;
  const gate = await requireAdmin(request);
  return gate.ok;
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getSettings();
  const result = await purgeExpired(settings.purge_after_days);
  return NextResponse.json({ ok: true, ...result, graceDays: settings.purge_after_days });
}
