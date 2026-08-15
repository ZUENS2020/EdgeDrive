import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getUsage, type UsageRange } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const raw = url.searchParams.get("range") || "month";
  const range: UsageRange = raw === "24h" || raw === "7d" || raw === "month" ? raw : "month";
  const data = await getUsage(range);
  return NextResponse.json(data);
}
