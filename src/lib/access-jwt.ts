/**
 * Cloudflare Access JWT 验证（Web Crypto——Workers/Edge 环境可用）。
 *
 * team / aud 从 D1 settings 读取（设置页填写），由调用方传入——不依赖 Worker 环境变量。
 * 验证：签名（JWKS 公钥）→ iss → aud → exp/nbf。
 * 参考：https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */

export type AccessJwtConfig = { team: string; aud: string };

const JWK_CACHE_TTL_MS = 6 * 3600e3;
let jwksCache: { keys: Record<string, CryptoKey>; fetchedAt: number } | null = null;

export function resetAccessJwtCacheForTests() {
  jwksCache = null;
}

export function accessIssuer(team: string): string | null {
  const t = team.trim();
  return t ? `https://${t}.cloudflareaccess.com` : null;
}

async function fetchJwks(issuer: string): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWK_CACHE_TTL_MS) return jwksCache.keys;
  const res = await fetch(`${issuer}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`access certs ${res.status}`);
  const body = (await res.json()) as { keys?: { kid?: string; kty?: string; n?: string; e?: string }[] };
  const keys: Record<string, CryptoKey> = {};
  for (const jwk of body.keys || []) {
    if (!jwk.kid || !jwk.n || !jwk.e) continue;
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty || "RSA", n: jwk.n, e: jwk.e, alg: "RS256", use: "sig" },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    keys[jwk.kid] = key;
  }
  jwksCache = { keys, fetchedAt: now };
  return keys;
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 返回 true 当且仅当 JWT 由 Cloudflare Access 签发且 aud/iss/exp 有效。 */
export async function verifyAccessJwt(jwt: string, config: AccessJwtConfig): Promise<boolean> {
  const issuer = accessIssuer(config.team);
  if (!issuer) {
    console.warn("[access-jwt] no issuer (team empty)", config.team);
    return false; // 未配置团队域——fail-closed
  }
  const aud = config.aud.trim();
  if (!aud) {
    console.warn("[access-jwt] no aud configured");
    return false;
  }

  const parts = jwt.split(".");
  if (parts.length !== 3) {
    console.warn("[access-jwt] jwt shape", parts.length);
    return false;
  }
  let header: { kid?: string; alg?: string };
  let payload: { iss?: string; aud?: string | string[]; exp?: number; nbf?: number };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch (e) {
    console.warn("[access-jwt] decode fail", String(e));
    return false;
  }
  if (header.alg !== "RS256" || !header.kid) {
    console.warn("[access-jwt] alg/kid", header.alg, header.kid);
    return false;
  }
  if (payload.iss !== issuer) {
    console.warn("[access-jwt] iss mismatch", payload.iss, "!=", issuer);
    return false;
  }
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud || ""];
  if (!auds.includes(aud)) {
    console.warn("[access-jwt] aud mismatch", auds, "!=", aud);
    return false;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || nowSec >= payload.exp) {
    console.warn("[access-jwt] exp", payload.exp, "now", nowSec);
    return false;
  }
  if (typeof payload.nbf === "number" && nowSec < payload.nbf) {
    console.warn("[access-jwt] nbf", payload.nbf);
    return false;
  }

  let keys: Record<string, CryptoKey>;
  try {
    keys = await fetchJwks(issuer);
  } catch (e) {
    console.warn("[access-jwt] jwks fetch fail", String(e));
    return false;
  }
  const key = keys[header.kid];
  if (!key) {
    console.warn("[access-jwt] kid not in jwks", header.kid, Object.keys(keys).length);
    return false;
  }

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sig = b64urlDecode(parts[2]);
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, sig, data);
  if (!ok) console.warn("[access-jwt] signature verify FAILED");
  return ok;
}
