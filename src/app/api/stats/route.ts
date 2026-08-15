import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getStats } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const origin = new URL(request.url).origin;
  const stats = await getStats(origin);
  return NextResponse.json(stats);
}
