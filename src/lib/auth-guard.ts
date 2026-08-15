import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createAuth } from "./auth";
import { getAuthMode } from "./cloudflare";

const SESSION_QUERY = { disableRefresh: true, disableCookieCache: true } as const;

export async function requireAdmin(request?: Request) {
  const mode = await getAuthMode();
  if (mode === "none") {
    return { ok: true as const, session: null, mode };
  }
  const auth = await createAuth();
  const hdrs = request ? request.headers : await headers();
  const session = await auth.api.getSession({
    headers: hdrs,
    query: SESSION_QUERY,
  });
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

/** RSC-safe gate: never write cookies during render (OpenNext/Workers 会因此 500). */
export async function requireAdminPage() {
  const mode = await getAuthMode();
  if (mode === "none") return { ok: true as const, mode };
  const hdrs = await headers();
  if (!hasSessionCookie(hdrs.get("cookie"))) {
    return { ok: false as const, mode };
  }
  try {
    const auth = await createAuth();
    const session = await auth.api.getSession({
      headers: hdrs,
      query: SESSION_QUERY,
    });
    return { ok: Boolean(session), mode };
  } catch {
    // Cookie 在但 Better Auth 在 RSC 里炸了：放行 HTML 壳，API 仍会鉴权。
    return { ok: true as const, mode };
  }
}
