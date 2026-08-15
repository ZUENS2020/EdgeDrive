import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createAuth } from "./auth";
import { getAuthMode } from "./cloudflare";

export async function requireAdmin(request?: Request) {
  const mode = await getAuthMode();
  if (mode === "none") {
    return { ok: true as const, session: null, mode };
  }
  const auth = await createAuth();
  const hdrs = request ? request.headers : await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    return {
      ok: false as const,
      session: null,
      mode,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true as const, session, mode };
}

export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookieHeader);
}
