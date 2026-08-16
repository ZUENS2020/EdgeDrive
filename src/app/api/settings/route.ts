import { NextResponse } from "next/server";
import { ensureCronSecret } from "@/lib/app-config";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB } from "@/lib/cloudflare";
import { getSettings, updateSettings, type SettingsPatch } from "@/lib/settings";
import type { SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

function toSafeSettings(settings: SiteSettings) {
  return {
    ...settings,
    cron_secret: "",
    cron_secret_set: Boolean(settings.cron_secret_set),
  };
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const db = await getDB();
  await ensureCronSecret(db);
  const settings = await getSettings(db);
  return NextResponse.json({ settings: toSafeSettings(settings) });
}

export async function PUT(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: SettingsPatch & { access_enabled?: unknown; auth_mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if ("access_enabled" in body || "auth_mode" in body) {
    return NextResponse.json({ error: "access-locked" }, { status: 400 });
  }
  try {
    const settings = await updateSettings(body);
    return NextResponse.json({ ok: true, settings: toSafeSettings(settings) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
