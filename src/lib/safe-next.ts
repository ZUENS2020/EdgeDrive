/** Only allow same-origin relative paths. Blocks open redirects via ?next=. */
export function safeInternalPath(raw: string | null | undefined, fallback = "/admin"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (raw.startsWith("/login") || raw === "/dl" || raw.startsWith("/dl/")) return fallback;
  return raw;
}
