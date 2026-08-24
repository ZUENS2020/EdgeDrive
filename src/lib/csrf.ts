const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Browser form/fetch CSRF: mutating admin APIs that rely on the Access cookie.
 * Missing Origin is allowed (curl, scheduled fetch, same-origin some agents).
 * Host is compared, not protocol — TLS-terminating proxies may present http internally.
 */
export function adminMutationAllowed(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return true;
  const origin = (request.headers.get("origin") || "").trim();
  if (!origin) return true;
  if (origin.toLowerCase() === "null") return false;
  try {
    const fromOrigin = new URL(origin);
    const forwardedHost = (request.headers.get("x-forwarded-host") || "").split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return fromOrigin.host.toLowerCase() === expectedHost.toLowerCase();
  } catch {
    return false;
  }
}
