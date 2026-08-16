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
import { fileLongPath, passwordPagePath, shortSharePath, withSearch } from "./share-urls";
import { renderPasswordPage } from "./share-page";
import { publicThemeVars } from "./themes";

describe("share password hashing", () => {
  it("hashes with salt and verifies with timing-safe compare", async () => {
    const stored = await hashSharePassword("secret");
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(await verifySharePassword(stored, "secret")).toBe(true);
    expect(await verifySharePassword(stored, "Secret")).toBe(false);
    expect(await verifySharePassword("not-a-hash", "secret")).toBe(false);
  });

  it("mints an HttpOnly cookie that expires and binds to the password hash", async () => {
    const hash = await hashSharePassword("pw");
    const now = Date.parse("2026-08-17T00:00:00.000Z");
    const value = await mintUnlockCookie(hash, "tok", now);
    expect(await verifyUnlockCookie(hash, "tok", value, now + 1000)).toBe(true);
    expect(await verifyUnlockCookie(hash, "other", value, now + 1000)).toBe(false);
    expect(await verifyUnlockCookie(hash, "tok", value, now + (SHARE_COOKIE_MAX_AGE + 1) * 1000)).toBe(false);
    const cookie = serializeShareCookie({ token: "tok", value, secure: true });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("ed_share_tok=");
  });
});

describe("share helpers", () => {
  it("parses cookies and rejects open redirects", () => {
    expect(parseCookieHeader("a=1; ed_share_x=hi%2Fthere")).toEqual({ a: "1", ed_share_x: "hi/there" });
    expect(safeShareNext("/dl/a.txt?t=1", "/")).toBe("/dl/a.txt?t=1");
    expect(safeShareNext("/s/Ab3xZ9", "/")).toBe("/s/Ab3xZ9");
    expect(safeShareNext("https://evil.test/", "/dl/x")).toBe("/dl/x");
    expect(safeShareNext("//evil.test", "/dl/x")).toBe("/dl/x");
    expect(safeShareNext("/admin", "/dl/x")).toBe("/dl/x");
  });

  it("builds readable long links and short links", () => {
    expect(fileLongPath({ path: "docs", name: "a.txt" }, "tok")).toBe("/dl/docs/a.txt?t=tok");
    expect(fileLongPath({ path: "docs", name: "a.txt" }, "tok", true)).toBe("/dl/docs/a.txt/view?t=tok");
    expect(shortSharePath("Ab3xZ9")).toBe("/s/Ab3xZ9");
    expect(passwordPagePath("tok", "/dl/a.txt?t=tok")).toContain("/share/tok");
    expect(withSearch("/dl/a", { t: "x", inline: "1" })).toBe("/dl/a?t=x&inline=1");
  });

  it("generates unique tokens and valid short codes", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateShareToken()));
    expect(tokens.size).toBe(20);
    expect(isShortCode(randomBase62(6))).toBe(true);
    expect(isShortCode("short")).toBe(false);
    expect(isShareLocked(lockUntilIso(Date.now()), Date.now() + 1000)).toBe(true);
    expect(isShareLocked(null)).toBe(false);
  });
});

describe("password page", () => {
  const theme = publicThemeVars("default");

  it("renders a themed bilingual form", () => {
    const zh = renderPasswordPage({ token: "tok", next: "/dl/a.txt?t=tok", theme, locale: "zh" });
    expect(zh).toContain("需要密码");
    expect(zh).toContain('name="password"');
    expect(zh).toContain("/api/share/tok/verify");
    expect(zh).toContain("lang=\"zh-CN\"");
    const en = renderPasswordPage({ token: "tok", next: "/dl/a.txt?t=tok", theme, locale: "en", state: "wrong" });
    expect(en).toContain("Password required");
    expect(en).toContain("Incorrect password");
    expect(en).not.toContain("需要密码");
  });

  it("shows lock and gone states", () => {
    const locked = renderPasswordPage({
      token: "tok",
      next: "/s/x",
      theme,
      state: "locked",
      minutes: 8,
    });
    expect(locked).toContain("8");
    const gone = renderPasswordPage({ token: "tok", next: "/", theme, state: "gone" });
    expect(gone).toContain("链接已失效");
    expect(gone).not.toContain('name="password"');
  });
});
