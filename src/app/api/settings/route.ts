import { NextResponse } from "next/server";
import { ensureCronSecret } from "@/lib/app-config";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB } from "@/lib/cloudflare";
import { isAuthModeLocked } from "@/lib/cloudflare";
import { getSettings, updateSettings, type SettingsPatch } from "@/lib/settings";
import type { SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

/** cron_secret 不下发明文（可触发 purge 的凭证）——只回布尔。 */
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
  return NextResponse.json({ settings: toSafeSettings(settings), authMode: gate.mode, authModeLocked: await isAuthModeLocked() });
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
  // 认证模式只能通过部署变量 AUTH_MODE 指定——API 一律拒绝（防误切锁死）
  if (body.auth_mode) {
    return NextResponse.json({ error: "auth-mode-locked: 认证模式由部署变量 AUTH_MODE 指定" }, { status: 400 });
  }
  try {
    const settings = await updateSettings(body);
    return NextResponse.json({ ok: true, settings: toSafeSettings(settings) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
