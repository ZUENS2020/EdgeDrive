import { timingSafeEqual } from "./timing-safe";

export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!header || !header.startsWith("Bearer ")) return false;
  return timingSafeEqual(header.slice("Bearer ".length), secret);
}

/** Cookie/JWT admin auth is CSRF-able on GET (top-level navigation). Settings UI uses POST. */
export function cronAllowsSessionAuth(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH";
}
