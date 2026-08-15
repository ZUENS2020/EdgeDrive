import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getSettings, updateSettings } from "@/lib/settings";
import type { SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;
    const settings = await getSettings();
    return NextResponse.json({ settings, authMode: gate.mode });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: Partial<SiteSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const settings = await updateSettings(body);
  return NextResponse.json({ ok: true, settings });
}
