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
  return NextResponse.json({ settings, authMode: gate.mode });
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
  return NextResponse.json({ ok: true, settings });
}
