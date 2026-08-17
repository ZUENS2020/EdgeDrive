import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getFileById, listFiles, moveFiles, setFileStarred, setFileTags } from "@/lib/store";
import { parseFileListFilter } from "@/lib/files-query";
import { getSettings } from "@/lib/settings";
import { requestOrigin } from "@/lib/share-urls";
import { serializeTags } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const settings = await getSettings();
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || settings.page_size);
  const filter = parseFileListFilter(url.searchParams.get("filter"));
  const data = await listFiles({
    origin: requestOrigin(request),
    path: url.searchParams.has("path") ? url.searchParams.get("path") || "" : undefined,
    q: url.searchParams.get("q") || undefined,
    page,
    pageSize,
    filter,
    tag: url.searchParams.get("tag") || undefined,
  });
  return NextResponse.json({ ...data, page, pageSize });
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: {
    id?: string;
    ids?: string[];
    name?: string;
    path?: string;
    tags?: string;
    starred?: number | boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ids = (body.ids || (body.id ? [body.id] : [])).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: "need ids" }, { status: 400 });
  const hasMove = body.path != null || Boolean(body.name);
  const hasTags = body.tags != null;
  const hasStar = body.starred != null;
  if (!hasMove && !hasTags && !hasStar) {
    return NextResponse.json({ error: "need name or path or tags or starred" }, { status: 400 });
  }
  if (hasTags) await setFileTags(ids, serializeTags(body.tags));
  if (hasStar) await setFileStarred(ids, body.starred ? 1 : 0);
  if (!hasMove) return NextResponse.json({ ok: true });
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
