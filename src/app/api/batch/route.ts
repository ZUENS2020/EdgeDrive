import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { handleCreateBatch } from "@/lib/batch";
import { getDB } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const db = await getDB();
  const result = await handleCreateBatch(db, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    previewUrl: result.previewUrl,
    downloadUrl: result.downloadUrl,
    count: result.count,
    expiresAt: result.expiresAt,
  });
}
