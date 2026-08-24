import { NextResponse } from "next/server";
import { z } from "zod";
import { setupTokenMatches } from "@/lib/auth-gate";
import { getDB, getSetupToken } from "@/lib/cloudflare";
import { DomainError } from "@/server/v2/errors";
import { enableAccessV2, readSettings } from "@/server/v2/settings";

export const dynamic = "force-dynamic";

const setupSchema = z.object({
  team: z.string().trim().min(1),
  aud: z.string().trim().min(1),
  setup_token: z.string().optional(),
});

export async function GET() {
  const settings = await readSettings(await getDB());
  const tokenRequired = Boolean(await getSetupToken());
  return NextResponse.json({
    access_enabled: settings.accessEnabled,
    token_required: tokenRequired && !settings.accessEnabled,
  });
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = setupSchema.parse(await request.json());
    if (!setupTokenMatches(await getSetupToken(), body.setup_token)) {
      return NextResponse.json({ error: "bad-setup-token" }, { status: 401 });
    }
    const settings = await enableAccessV2(db, body.team, body.aud);
    return NextResponse.json({ ok: true, settings: { access_enabled: settings.accessEnabled } });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "invalid-input" }, { status: 400 });
    return NextResponse.json({ error: "setup-failed" }, { status: 500 });
  }
}
