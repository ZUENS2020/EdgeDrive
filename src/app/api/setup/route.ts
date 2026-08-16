import { NextResponse } from "next/server";
import { setupTokenMatches } from "@/lib/auth-gate";
import { getDB, getSetupToken } from "@/lib/cloudflare";
import { enableAccess, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDB();
  const settings = await getSettings(db);
  const tokenRequired = Boolean(await getSetupToken());
  return NextResponse.json({
    access_enabled: settings.access_enabled,
    token_required: tokenRequired && !settings.access_enabled,
  });
}

export async function POST(request: Request) {
  const db = await getDB();
  const settings = await getSettings(db);
  if (settings.access_enabled) {
    return NextResponse.json({ error: "access-already-enabled" }, { status: 409 });
  }

  let body: { team?: string; aud?: string; setup_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const expected = await getSetupToken();
  if (!setupTokenMatches(expected, body.setup_token)) {
    return NextResponse.json({ error: "bad-setup-token" }, { status: 401 });
  }

  try {
    const next = await enableAccess(String(body.team || ""), String(body.aud || ""), db);
    return NextResponse.json({ ok: true, settings: { access_enabled: next.access_enabled } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "enable-failed";
    if (message.startsWith("access-needs-team-aud")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message === "access-already-enabled") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw err;
  }
}
