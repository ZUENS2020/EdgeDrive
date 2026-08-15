import { NextResponse } from "next/server";
import { ensureCronSecret } from "@/lib/app-config";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB } from "@/lib/cloudflare";
import { getSettings, updateSettings, type SettingsPatch } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const db = await getDB();
  await ensureCronSecret(db);
  const settings = await getSettings(db);
  // cron_secret 不下发明文（可触发 purge 的凭证）——只回布尔
  const safe = { ...settings, cron_secret: "", cron_secret_set: Boolean(settings.cron_secret) };
  return NextResponse.json({ settings: safe, authMode: gate.mode });
}

export async function PUT(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: SettingsPatch;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const settings = await updateSettings(body);
  const safe = { ...settings, cron_secret: "", cron_secret_set: Boolean(settings.cron_secret) };
  return NextResponse.json({ ok: true, settings: safe });
}
