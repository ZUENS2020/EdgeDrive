import { timingSafeEqual } from "./timing-safe";

export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!header || !header.startsWith("Bearer ")) return false;
  return timingSafeEqual(header.slice("Bearer ".length), secret);
}
