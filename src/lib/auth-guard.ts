import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAccessJwt } from "./access-jwt";
import { evaluateAdminGate, evaluateAdminPageGate } from "./auth-gate";
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

async function accessVerified(hdrs: Headers, team: string, aud: string): Promise<boolean> {
  const jwt = hdrs.get("cf-access-jwt-assertion");
  if (!jwt) return false;
  return verifyAccessJwt(jwt, { team, aud });
}

export async function requireAdmin(request?: Request) {
  const settings = await accessJwtFromSettings();
  const hdrs = request ? request.headers : await headers();
  const jwt = hdrs.get("cf-access-jwt-assertion");
  console.warn(
    "[auth-debug] requireAdmin: jwt header=",
    jwt ? `present(${jwt.length} chars)` : "MISSING",
    "| enabled=",
    settings.enabled,
    "| team=",
    settings.team,
    "| aud=",
    settings.aud.slice(0, 8),
    "| all-access-headers=",
    [...hdrs.keys()].filter((k) => k.toLowerCase().includes("access") || k.toLowerCase().includes("authorization") || k.toLowerCase().includes("cookie")),
  );
  const verified = jwt ? await verifyAccessJwt(jwt, { team: settings.team, aud: settings.aud }) : false;
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
  return { ok: true as const, setup: false as const };
}

/** RSC-safe gate: never write cookies during render (OpenNext/Workers 会因此 500). */
export async function requireAdminPage() {
  const settings = await accessJwtFromSettings();
  const hdrs = await headers();
  const jwt = hdrs.get("cf-access-jwt-assertion");
  const verified = jwt ? await accessVerified(hdrs, settings.team, settings.aud) : false;
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
