import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getFileById, listFiles, moveFiles } from "@/lib/store";
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

export async function PATCH(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: { id?: string; ids?: string[]; name?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ids = (body.ids || (body.id ? [body.id] : [])).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: "need ids" }, { status: 400 });
  if (body.path == null && !body.name) {
    return NextResponse.json({ error: "need name or path" }, { status: 400 });
  }
  let dest = body.path;
  if (dest == null) {
    const row = await getFileById(ids[0]);
    if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 });
    dest = row.path;
  }
  try {
    const result = await moveFiles(ids, dest, body.name);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = String((err as Error).message || err);
    const status =
      msg === "file-exists" || msg === "folder-not-found" || msg === "rename-single" ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
