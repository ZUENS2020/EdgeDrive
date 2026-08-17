import { requestOrigin } from "./share-urls";

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
    const expected = new URL(requestOrigin(request));
    return fromOrigin.host.toLowerCase() === expected.host.toLowerCase();
  } catch {
    return false;
  }
}
