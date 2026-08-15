import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { listFiles } from "@/lib/store";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const settings = await getSettings();
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || settings.page_size);
  const filter = (url.searchParams.get("filter") || "all") as "all" | "ok" | "soon" | "expired";
  const data = await listFiles({
    origin: url.origin,
    path: url.searchParams.has("path") ? url.searchParams.get("path") || "" : undefined,
    q: url.searchParams.get("q") || undefined,
    page,
    pageSize,
    filter,
  });
  return NextResponse.json({ ...data, page, pageSize });
}
