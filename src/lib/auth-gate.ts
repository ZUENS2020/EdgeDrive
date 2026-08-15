import { isAccessMode } from "./types";

export function evaluateAdminGate(input: {
  mode: string;
  hasAccessJwt: boolean;
  accessVerified: boolean;
  hasSession: boolean;
}): { ok: boolean } {
  if (isAccessMode(input.mode)) {
    return { ok: input.hasAccessJwt && input.accessVerified };
  }
  return { ok: input.hasSession };
}

export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookieHeader);
}
