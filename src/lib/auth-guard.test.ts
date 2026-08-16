import { describe, expect, it } from "vitest";
import { evaluateAdminGate, evaluateAdminPageGate, setupTokenMatches } from "./auth-gate";

describe("evaluateAdminGate", () => {
  it("setup mode rejects API access until Access is enabled", () => {
    expect(
      evaluateAdminGate({
        accessEnabled: false,
        hasAccessJwt: false,
        accessVerified: false,
      }),
    ).toEqual({ ok: false, kind: "setup" });
  });

  it("setup mode still rejects even if a JWT is present", () => {
    expect(
      evaluateAdminGate({
        accessEnabled: false,
        hasAccessJwt: true,
        accessVerified: true,
      }),
    ).toEqual({ ok: false, kind: "setup" });
  });

  it("enabled Access rejects missing JWT", () => {
    expect(
      evaluateAdminGate({
        accessEnabled: true,
        hasAccessJwt: false,
        accessVerified: false,
      }),
    ).toEqual({ ok: false, kind: "unauthorized" });
  });

  it("enabled Access rejects invalid JWT", () => {
    expect(
      evaluateAdminGate({
        accessEnabled: true,
        hasAccessJwt: true,
        accessVerified: false,
      }),
    ).toEqual({ ok: false, kind: "unauthorized" });
  });

  it("enabled Access accepts verified JWT", () => {
    expect(
      evaluateAdminGate({
        accessEnabled: true,
        hasAccessJwt: true,
        accessVerified: true,
      }),
    ).toEqual({ ok: true, kind: "admin" });
  });
});

describe("evaluateAdminPageGate", () => {
  it("unenabled Access sends the page into setup", () => {
    expect(
      evaluateAdminPageGate({
        accessEnabled: false,
        hasAccessJwt: false,
        accessVerified: false,
      }),
    ).toEqual({ ok: false, kind: "setup" });
  });

  it("enabled Access without JWT is unauthorized", () => {
    expect(
      evaluateAdminPageGate({
        accessEnabled: true,
        hasAccessJwt: false,
        accessVerified: false,
      }),
    ).toEqual({ ok: false, kind: "unauthorized" });
  });
});

describe("setupTokenMatches", () => {
  it("allows first-boot when SETUP_TOKEN is unset", () => {
    expect(setupTokenMatches(undefined, undefined)).toBe(true);
    expect(setupTokenMatches("", "anything")).toBe(true);
  });

  it("requires an exact match when SETUP_TOKEN is set", () => {
    expect(setupTokenMatches("secret", "secret")).toBe(true);
    expect(setupTokenMatches("secret", "nope")).toBe(false);
    expect(setupTokenMatches("secret", undefined)).toBe(false);
  });
});
