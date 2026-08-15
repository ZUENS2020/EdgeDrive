import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createAuth } from "./auth";
import { getAuthMode, isAccessMode } from "./cloudflare";

const SESSION_QUERY = { disableRefresh: true, disableCookieCache: true } as const;

/** Cloudflare Access 模式：校验 CF Access 注入的请求头（fail-closed——头不存在一律拒绝）。 */
function accessVerified(hdrs: Headers): boolean {
  const email = hdrs.get("cf-access-authenticated-user-email");
  const jwt = hdrs.get("cf-access-jwt-assertion");
  return Boolean(email || jwt);
}

export async function requireAdmin(request?: Request) {
  const mode = await getAuthMode();
  if (isAccessMode(mode)) {
    const hdrs = request ? request.headers : await headers();
    if (!accessVerified(hdrs)) {
      return {
        ok: false as const,
        session: null,
        mode,
        response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      };
    }
    return { ok: true as const, session: null, mode };
  }
  const hdrs = request ? request.headers : await headers();
  const auth = await createAuth(request ?? hdrs);
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
  if (isAccessMode(mode)) {
    const hdrs = await headers();
    return { ok: accessVerified(hdrs), mode };
  }
  const hdrs = await headers();
  if (!hasSessionCookie(hdrs.get("cookie"))) {
    return { ok: false as const, mode };
  }
  try {
    const auth = await createAuth(hdrs);
    const session = await auth.api.getSession({
      headers: hdrs,
      query: SESSION_QUERY,
    });
    return { ok: Boolean(session), mode };
  } catch {
    return { ok: false as const, mode };
  }
}
