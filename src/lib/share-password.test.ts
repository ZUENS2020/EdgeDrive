import { describe, expect, it } from "vitest";
import {
  hashSharePassword,
  isShareLocked,
  lockUntilIso,
  mintUnlockCookie,
  parseCookieHeader,
  safeShareNext,
  serializeShareCookie,
  SHARE_COOKIE_MAX_AGE,
  verifySharePassword,
  verifyUnlockCookie,
} from "./share-password";
import { generateShareToken, isShortCode, randomBase62 } from "./share-token";

describe("v2 share credentials", () => {
  it("salts passwords and binds unlock cookies to a share token", async () => {
    const stored = await hashSharePassword("secret");
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(await verifySharePassword(stored, "secret")).toBe(true);
    expect(await verifySharePassword(stored, "Secret")).toBe(false);
    const now = Date.parse("2026-08-24T00:00:00.000Z");
    const value = await mintUnlockCookie(stored, "tok", now);
    expect(await verifyUnlockCookie(stored, "tok", value, now + 1000)).toBe(true);
    expect(await verifyUnlockCookie(stored, "other", value, now + 1000)).toBe(false);
    expect(await verifyUnlockCookie(stored, "tok", value, now + (SHARE_COOKIE_MAX_AGE + 1) * 1000)).toBe(false);
    expect(serializeShareCookie({ token: "tok", value, secure: true })).toMatch(/HttpOnly.*SameSite=Lax.*Secure/);
  });

  it("allows only v2 public routes as post-unlock targets", () => {
    expect(parseCookieHeader("a=1; ed_share_x=hi%2Fthere")).toEqual({ a: "1", ed_share_x: "hi/there" });
    expect(safeShareNext("/p/Ab3xZ9pqL0", "/")).toBe("/p/Ab3xZ9pqL0");
    expect(safeShareNext("/s/Ab3xZ9pqL0", "/")).toBe("/s/Ab3xZ9pqL0");
    expect(safeShareNext("https://evil.test/", "/s/fallback")).toBe("/s/fallback");
    expect(safeShareNext("//evil.test", "/s/fallback")).toBe("/s/fallback");
    expect(safeShareNext("/admin", "/s/fallback")).toBe("/s/fallback");
  });

  it("generates high-entropy tokens and fixed-width v2 codes", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateShareToken()));
    expect(tokens.size).toBe(20);
    expect(isShortCode(randomBase62(10))).toBe(true);
    expect(isShortCode(randomBase62(8))).toBe(false);
    expect(isShareLocked(lockUntilIso(Date.now()), Date.now() + 1000)).toBe(true);
    expect(isShareLocked(null)).toBe(false);
  });
});
