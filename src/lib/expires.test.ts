import { afterEach, describe, expect, it, vi } from "vitest";
import { expireFromSearchParams, parseDefaultExpires, parseExpireInput } from "./expires";

describe("parseExpireInput", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permanent and expireNow", () => {
    expect(parseExpireInput({ permanent: true })).toEqual({ value: null });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T00:00:00.000Z"));
    const now = parseExpireInput({ expireNow: true });
    expect(now.error).toBeUndefined();
    expect(new Date(now.value!).toISOString()).toBe("2026-08-15T23:59:00.000Z");
  });

  it("parses expires ISO and rejects garbage", () => {
    const ok = parseExpireInput({ expires: "2026-12-01T00:00:00.000Z" });
    expect(ok.value).toBe("2026-12-01T00:00:00.000Z");
    expect(parseExpireInput({ expires: "not-a-date" }).error).toMatch(/invalid expires/);
  });

  it("hours/days must be positive and bounded", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    expect(parseExpireInput({ hours: 2 }).value).toBe("2026-01-01T02:00:00.000Z");
    expect(parseExpireInput({ days: 1 }).value).toBe("2026-01-02T00:00:00.000Z");
    expect(parseExpireInput({ hours: 0 }).error).toMatch(/hours/);
    expect(parseExpireInput({ days: -1 }).error).toMatch(/days/);
    expect(parseExpireInput({ hours: 24 * 365 * 11 }).error).toMatch(/too large/);
    expect(parseExpireInput({ days: 365 * 11 }).error).toMatch(/too large/);
  });

  it("defaults to null when nothing provided", () => {
    expect(parseExpireInput({})).toEqual({ value: null });
  });
});

describe("parseDefaultExpires", () => {
  it("permanent aliases and default 24h", () => {
    expect(parseDefaultExpires("permanent")).toEqual({ permanent: true });
    expect(parseDefaultExpires("none")).toEqual({ permanent: true });
    expect(parseDefaultExpires("0")).toEqual({ permanent: true });
    expect(parseDefaultExpires(undefined)).toEqual({ hours: 24 });
    expect(parseDefaultExpires("bogus")).toEqual({ hours: 24 });
    expect(parseDefaultExpires("3d")).toEqual({ days: 3 });
    expect(parseDefaultExpires("12h")).toEqual({ hours: 12 });
  });
});

describe("expireFromSearchParams", () => {
  it("reads query flags", () => {
    expect(expireFromSearchParams(new URLSearchParams("permanent=1"))).toEqual({ permanent: true });
    expect(expireFromSearchParams(new URLSearchParams("expireNow=1"))).toEqual({ expireNow: true });
    expect(expireFromSearchParams(new URLSearchParams("hours=3")).hours).toBe(3);
  });
});
