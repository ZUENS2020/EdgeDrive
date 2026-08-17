import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAccessJwt } from "./access-jwt";
import { evaluateAdminGate, evaluateAdminPageGate } from "./auth-gate";
import { adminMutationAllowed } from "./csrf";
import { getSettings } from "./settings";

export { evaluateAdminGate, evaluateAdminPageGate, setupTokenMatches } from "./auth-gate";

async function accessJwtFromSettings() {
  const settings = await getSettings();
  return {
    enabled: settings.access_enabled,
    team: settings.cf_access_team,
    aud: settings.cf_access_aud,
  };
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

/**
 * 获取 Access JWT：优先请求头 cf-access-jwt-assertion；头缺失时
 * 兼容 CF_Authorization cookie（部分 Access 配置只传 cookie 不注入头）。
 */
export function getAccessJwt(hdrs: Headers): string | null {
  const fromHeader = hdrs.get("cf-access-jwt-assertion");
  if (fromHeader) return fromHeader;
  const cookies = parseCookies(hdrs.get("cookie"));
  return cookies["CF_Authorization"] || null;
}

async function jwtVerified(hdrs: Headers, team: string, aud: string): Promise<{ jwt: string | null; verified: boolean }> {
  const jwt = getAccessJwt(hdrs);
  if (!jwt) return { jwt: null, verified: false };
  return { jwt, verified: await verifyAccessJwt(jwt, { team, aud }) };
}

export async function requireAdmin(request?: Request) {
  const settings = await accessJwtFromSettings();
  const hdrs = request ? request.headers : await headers();
  const { jwt, verified } = await jwtVerified(hdrs, settings.team, settings.aud);
  const gate = evaluateAdminGate({
    accessEnabled: settings.enabled,
    hasAccessJwt: Boolean(jwt),
    accessVerified: verified,
  });
  if (!gate.ok) {
    const status = gate.kind === "setup" ? 403 : 401;
    const error = gate.kind === "setup" ? "setup-required" : "unauthorized";
    return {
      ok: false as const,
      setup: gate.kind === "setup",
      response: NextResponse.json({ error }, { status }),
    };
  }
  if (request && !adminMutationAllowed(request)) {
    return {
      ok: false as const,
      setup: false as const,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, setup: false as const };
}

/** RSC-safe gate: never write cookies during render (OpenNext/Workers 会因此 500). */
export async function requireAdminPage() {
  const settings = await accessJwtFromSettings();
  const hdrs = await headers();
  const { jwt, verified } = await jwtVerified(hdrs, settings.team, settings.aud);
  const gate = evaluateAdminPageGate({
    accessEnabled: settings.enabled,
    hasAccessJwt: Boolean(jwt),
    accessVerified: verified,
  });
  return {
    ok: gate.ok,
    setup: gate.kind === "setup",
    unauthorized: gate.kind === "unauthorized",
  };
}
