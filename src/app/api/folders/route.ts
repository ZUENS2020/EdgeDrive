import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { createFolder, deleteFolder, listFolders, renameFolder } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const folders = await listFolders();
  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: { name?: string; parent_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const folder = await createFolder(body.name || "", body.parent_id || "");
    return NextResponse.json({ ok: true, folder });
  } catch (err) {
    return folderError(err);
  }
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: { id?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.id || !body.name) return NextResponse.json({ error: "need id and name" }, { status: 400 });
  try {
    const folder = await renameFolder(body.id, body.name);
    return NextResponse.json({ ok: true, folder });
  } catch (err) {
    return folderError(err);
  }
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "need id" }, { status: 400 });
  try {
    const result = await deleteFolder(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return folderError(err);
  }
}

function folderError(err: unknown) {
  const message = String((err as Error).message || err);
  if (message === "folder-exists") {
    return NextResponse.json({ error: "folder-exists" }, { status: 409 });
  }
  if (message === "not-found" || message === "parent-not-found") {
    return NextResponse.json({ error: "folder-not-found" }, { status: 404 });
  }
  if (message === "invalid-name" || message === "empty" || message === "too-long" || message === "control-chars") {
    return NextResponse.json({ error: "invalid-name" }, { status: 400 });
  }
  return NextResponse.json({ error: "folder-failed" }, { status: 400 });
}
