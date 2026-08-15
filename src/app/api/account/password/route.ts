import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  if (gate.mode !== "password") {
    return NextResponse.json({ error: "password-mode-only" }, { status: 400 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!currentPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "new-password-min-8" }, { status: 400 });
  }

  const db = await getDB();
  const admin = await db.prepare("SELECT * FROM admin LIMIT 1").first<{
    id: string;
    username: string;
    password_hash: string;
  }>();
  if (!admin) return NextResponse.json({ error: "no-admin" }, { status: 400 });
  const ok = await compare(currentPassword, admin.password_hash);
  if (!ok) return NextResponse.json({ error: "bad-current" }, { status: 401 });

  const nextHash = await hash(newPassword, BCRYPT_ROUNDS);
  await db.prepare("UPDATE admin SET password_hash = ? WHERE id = ?").bind(nextHash, admin.id).run();
  await db
    .prepare('UPDATE "account" SET password = ? WHERE providerId = ? AND userId IN (SELECT id FROM "user" WHERE username = ?)')
    .bind(nextHash, "credential", admin.username)
    .run();
  return NextResponse.json({ ok: true });
}
