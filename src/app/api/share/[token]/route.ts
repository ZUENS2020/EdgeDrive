import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB } from "@/lib/cloudflare";
import { deleteShareLink, getShareView, patchShare } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const { token } = await ctx.params;
  const db = await getDB();
  const link = await getShareView(db, token);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ link });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const { token } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const db = await getDB();
  const result = await patchShare(db, token, (body || {}) as Record<string, unknown>);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ link: result.link });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const { token } = await ctx.params;
  const db = await getDB();
  const ok = await deleteShareLink(db, token);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
