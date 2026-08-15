import { NextResponse } from "next/server";
import { createFirstAdmin, isValidUsername } from "@/lib/auth";
import { getAuthMode, getDB, isAccessMode } from "@/lib/cloudflare";
import { hasAdmin } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isAccessMode(await getAuthMode())) {
    return NextResponse.json({ error: "access-mode" }, { status: 404 });
  }
  const db = await getDB();
  if (await hasAdmin(db)) {
    return NextResponse.json({ error: "admin-exists" }, { status: 409 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "bad-username" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password-min-8" }, { status: 400 });
  }

  try {
    await createFirstAdmin(username, password);
  } catch (err) {
    if (err instanceof Error && err.message === "admin-exists") {
      return NextResponse.json({ error: "admin-exists" }, { status: 409 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
