import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB } from "@/lib/cloudflare";
import { assignShareShortCode } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const { token } = await ctx.params;
  const db = await getDB();
  const result = await assignShareShortCode(db, token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ shortCode: result.shortCode, shortUrl: result.shortUrl });
}
