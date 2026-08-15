import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAccessJwt } from "./access-jwt";
import { createAuth } from "./auth";
import { evaluateAdminGate, hasSessionCookie } from "./auth-gate";
import { getAuthMode, isAccessMode } from "./cloudflare";

export { evaluateAdminGate, hasSessionCookie } from "./auth-gate";

const SESSION_QUERY = { disableRefresh: true, disableCookieCache: true } as const;

/** Cloudflare Access 模式：验证 CF Access JWT（签名/iss/aud/exp）——fail-closed（未配置或无效一律拒绝）。 */
async function accessVerified(hdrs: Headers): Promise<boolean> {
  const jwt = hdrs.get("cf-access-jwt-assertion");
  if (!jwt) return false;
  return verifyAccessJwt(jwt);
}

export async function requireAdmin(request?: Request) {
  const mode = await getAuthMode();
  const hdrs = request ? request.headers : await headers();
  if (isAccessMode(mode)) {
    const jwt = hdrs.get("cf-access-jwt-assertion");
    const gate = evaluateAdminGate({
      mode,
      hasAccessJwt: Boolean(jwt),
      accessVerified: jwt ? await verifyAccessJwt(jwt) : false,
      hasSession: false,
    });
    if (!gate.ok) {
      return {
        ok: false as const,
        session: null,
        mode,
        response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      };
    }
    return { ok: true as const, session: null, mode };
  }
  const auth = await createAuth(request ?? hdrs);
  const session = await auth.api.getSession({
    headers: hdrs,
    query: SESSION_QUERY,
  });
  const gate = evaluateAdminGate({
    mode,
    hasAccessJwt: false,
    accessVerified: false,
    hasSession: Boolean(session),
  });
  if (!gate.ok) {
    return {
      ok: false as const,
      session: null,
      mode,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true as const, session, mode };
}

/** RSC-safe gate: never write cookies during render (OpenNext/Workers 会因此 500). */
export async function requireAdminPage() {
  const mode = await getAuthMode();
  if (isAccessMode(mode)) {
    const hdrs = await headers();
    return { ok: await accessVerified(hdrs), mode };
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
