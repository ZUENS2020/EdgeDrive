import { NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = await (await getDB()).prepare("SELECT schema_version FROM app_settings WHERE id = 1").first<{ schema_version: number }>();
    return NextResponse.json({ ok: row?.schema_version === 1, schema: row?.schema_version || null, ts: new Date().toISOString() }, { status: row?.schema_version === 1 ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false, schema: null, ts: new Date().toISOString() }, { status: 503 });
  }
}
