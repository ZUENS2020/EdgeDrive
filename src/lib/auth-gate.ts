import { timingSafeEqual } from "./timing-safe";

export type AdminGateInput = {
  accessEnabled: boolean;
  hasAccessJwt: boolean;
  accessVerified: boolean;
};

export type AdminGateResult =
  | { ok: true; kind: "admin" }
  | { ok: false; kind: "setup" }
  | { ok: false; kind: "unauthorized" };

/** API 守卫：未启用 → setup（调用方应走引导，而不是当已登录）；已启用 → 只认 Access JWT。 */
export function evaluateAdminGate(input: AdminGateInput): AdminGateResult {
  if (!input.accessEnabled) return { ok: false, kind: "setup" };
  if (input.hasAccessJwt && input.accessVerified) return { ok: true, kind: "admin" };
  return { ok: false, kind: "unauthorized" };
}

/** 页面守卫与 API 守卫同一规则（未启用 → setup；已启用 → 验 JWT）。 */
export const evaluateAdminPageGate = evaluateAdminGate;

export function setupTokenMatches(expected: string | undefined, provided: string | undefined): boolean {
  const want = (expected || "").trim();
  if (!want) return true;
  return timingSafeEqual(want, (provided || "").trim());
}
