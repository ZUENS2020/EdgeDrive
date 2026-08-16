import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare";
import { lockRemainingMinutes } from "@/lib/share-password";
import { passwordPagePath, withSearch } from "@/lib/share-urls";
import { verifySharePasswordAttempt } from "@/lib/share";

export const dynamic = "force-dynamic";

function wantsHtml(request: NextRequest, contentType: string): boolean {
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return true;
  }
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

async function readPassword(request: NextRequest): Promise<{ password: string; next?: string }> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { password?: unknown; next?: unknown };
    return {
      password: typeof body.password === "string" ? body.password : "",
      next: typeof body.next === "string" ? body.next : undefined,
    };
  }
  const form = await request.formData().catch(() => null);
  if (!form) return { password: "" };
  const password = form.get("password");
  const next = form.get("next");
  return {
    password: typeof password === "string" ? password : "",
    next: typeof next === "string" ? next : undefined,
  };
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const contentType = request.headers.get("content-type") || "";
  const html = wantsHtml(request, contentType);
  const { password, next } = await readPassword(request);
  const db = await getDB();
  const secure = request.nextUrl.protocol === "https:";
  const result = await verifySharePasswordAttempt(db, token, password, { next, secure });

  if (html) {
    if (!result.ok) {
      const err =
        result.error === "locked"
          ? "locked"
          : result.error === "bad password"
            ? "wrong"
            : result.status === 410 || result.status === 404
              ? "gone"
              : "missing";
      const location = withSearch(passwordPagePath(token, next), {
        e: err,
        m: err === "locked" ? String(lockRemainingMinutes(result.lockedUntil || null)) : undefined,
      });
      return new NextResponse(null, { status: 302, headers: { Location: location } });
    }
    const headers = new Headers({ Location: result.next });
    if (result.setCookie) headers.append("Set-Cookie", result.setCookie);
    return new NextResponse(null, { status: 302, headers });
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, lockedUntil: result.lockedUntil },
      { status: result.status },
    );
  }
  const headers = new Headers();
  if (result.setCookie) headers.append("Set-Cookie", result.setCookie);
  return NextResponse.json({ ok: true, next: result.next }, { headers });
}
