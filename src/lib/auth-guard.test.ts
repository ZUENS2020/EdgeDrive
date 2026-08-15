import { describe, expect, it } from "vitest";
import { evaluateAdminGate, hasSessionCookie } from "./auth-gate";

describe("evaluateAdminGate", () => {
  it("password mode rejects missing session", () => {
    expect(
      evaluateAdminGate({
        mode: "password",
        hasAccessJwt: false,
        accessVerified: false,
        hasSession: false,
      }),
    ).toEqual({ ok: false });
  });

  it("password mode accepts a session", () => {
    expect(
      evaluateAdminGate({
        mode: "password",
        hasAccessJwt: false,
        accessVerified: false,
        hasSession: true,
      }),
    ).toEqual({ ok: true });
  });

  it("access mode rejects missing JWT", () => {
    expect(
      evaluateAdminGate({
        mode: "access",
        hasAccessJwt: false,
        accessVerified: false,
        hasSession: true,
      }),
    ).toEqual({ ok: false });
  });

  it("access mode rejects invalid JWT", () => {
    expect(
      evaluateAdminGate({
        mode: "access",
        hasAccessJwt: true,
        accessVerified: false,
        hasSession: false,
      }),
    ).toEqual({ ok: false });
  });

  it("access mode accepts verified JWT", () => {
    expect(
      evaluateAdminGate({
        mode: "access",
        hasAccessJwt: true,
        accessVerified: true,
        hasSession: false,
      }),
    ).toEqual({ ok: true });
  });
});

describe("hasSessionCookie", () => {
  it("detects better-auth session cookie", () => {
    expect(hasSessionCookie(null)).toBe(false);
    expect(hasSessionCookie("better-auth.session_token=abc")).toBe(true);
    expect(hasSessionCookie("__Secure-better-auth.session_token=abc")).toBe(true);
    expect(hasSessionCookie("other=1")).toBe(false);
  });
});
