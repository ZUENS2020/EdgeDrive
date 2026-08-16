import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAccessJwtCacheForTests, verifyAccessJwt } from "./access-jwt";

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };

function jwt(payload: Record<string, unknown>, opts?: { kid?: string; alg?: string; key?: typeof privateKey }) {
  const header = { alg: opts?.alg ?? "RS256", kid: opts?.kid ?? "kid-1" };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = sign("RSA-SHA256", Buffer.from(data), opts?.key ?? privateKey);
  return `${data}.${b64url(sig)}`;
}

const TEAM = "zuens2020";
const AUD = "aud-tag-1";
const CFG = { team: TEAM, aud: AUD };
const ISS = `https://${TEAM}.cloudflareaccess.com`;

describe("verifyAccessJwt", () => {
  beforeEach(() => {
    resetAccessJwtCacheForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ keys: [{ kid: "kid-1", kty: "RSA", n: jwk.n, e: jwk.e }] }),
      })),
    );
  });

  afterEach(() => {
    resetAccessJwtCacheForTests();
    vi.unstubAllGlobals();
  });

  it("accepts a valid Access JWT", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt({ iss: ISS, aud: AUD, exp: now + 3600, nbf: now - 10 });
    expect(await verifyAccessJwt(token, CFG)).toBe(true);
  });

  it("rejects a forged signature", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt({ iss: ISS, aud: AUD, exp: now + 3600 });
    const [h, p] = token.split(".");
    expect(await verifyAccessJwt(`${h}.${p}.AAAA`, CFG)).toBe(false);
  });

  it("rejects expired tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt({ iss: ISS, aud: AUD, exp: now - 10 });
    expect(await verifyAccessJwt(token, CFG)).toBe(false);
  });

  it("rejects wrong aud", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt({ iss: ISS, aud: "other", exp: now + 3600 });
    expect(await verifyAccessJwt(token, CFG)).toBe(false);
  });

  it("rejects wrong iss", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt({ iss: "https://evil.example", aud: AUD, exp: now + 3600 });
    expect(await verifyAccessJwt(token, CFG)).toBe(false);
  });

  it("rejects malformed JWT", async () => {
    expect(await verifyAccessJwt("not-a-jwt", CFG)).toBe(false);
    expect(await verifyAccessJwt("a.b", CFG)).toBe(false);
    expect(await verifyAccessJwt("%%%", CFG)).toBe(false);
  });

  it("fail-closed without team/aud", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt({ iss: ISS, aud: AUD, exp: now + 3600 });
    expect(await verifyAccessJwt(token, { team: "", aud: AUD })).toBe(false);
    expect(await verifyAccessJwt(token, { team: TEAM, aud: "" })).toBe(false);
  });
});
