import { describe, expect, it } from "vitest";
import { evaluateSchemaVersion, missingCoreTables } from "./d1-bootstrap";
import { EXPECTED_SCHEMA_VERSION } from "./d1-bootstrap-sql";
import { shouldCountDownload } from "./download-policy";
import { cfApiTokenConfigured, readEnvSecret } from "./cf-credentials";
import { bearerMatches } from "./cron-auth";

describe("d1 schema helpers", () => {
  it("lists missing core tables", () => {
    expect(missingCoreTables(["files", "settings"])).toContain("folders");
    expect(missingCoreTables(["files", "folders", "settings"])).toEqual([]);
  });

  it("treats missing version as untracked and old as stale", () => {
    expect(EXPECTED_SCHEMA_VERSION).toBe(8);
    expect(evaluateSchemaVersion(undefined, 8)).toBe("untracked");
    expect(evaluateSchemaVersion("", 8)).toBe("untracked");
    expect(evaluateSchemaVersion("7", 8)).toBe("stale");
    expect(evaluateSchemaVersion("8", 8)).toBe("ok");
    expect(evaluateSchemaVersion("9", 8)).toBe("ok");
  });
});

describe("shouldCountDownload", () => {
  it("skips HEAD, inline preview and non-initial range", () => {
    expect(shouldCountDownload({ headOnly: true, inline: false, range: null })).toBe(false);
    expect(shouldCountDownload({ headOnly: false, inline: true, range: null })).toBe(false);
    expect(shouldCountDownload({ headOnly: false, inline: false, range: { start: 8 } })).toBe(false);
    expect(shouldCountDownload({ headOnly: false, inline: false, range: null })).toBe(true);
    expect(shouldCountDownload({ headOnly: false, inline: false, range: { start: 0 } })).toBe(true);
  });
});

describe("cf credentials", () => {
  it("prefers env over D1 and ignores NULL", () => {
    const prev = process.env.CF_API_TOKEN;
    delete process.env.CF_API_TOKEN;
    expect(readEnvSecret("CF_API_TOKEN")).toBeUndefined();
    expect(cfApiTokenConfigured("d1-token")).toBe(true);
    expect(cfApiTokenConfigured(undefined)).toBe(false);
    process.env.CF_API_TOKEN = "NULL";
    expect(readEnvSecret("CF_API_TOKEN")).toBeUndefined();
    process.env.CF_API_TOKEN = "secret-from-worker";
    expect(readEnvSecret("CF_API_TOKEN")).toBe("secret-from-worker");
    expect(cfApiTokenConfigured(undefined)).toBe(true);
    if (prev === undefined) delete process.env.CF_API_TOKEN;
    else process.env.CF_API_TOKEN = prev;
  });
});

describe("purge bearer", () => {
  it("requires exact Bearer match", () => {
    expect(bearerMatches("Bearer abc", "abc")).toBe(true);
    expect(bearerMatches("Bearer abc", "xyz")).toBe(false);
    expect(bearerMatches(null, "abc")).toBe(false);
    expect(bearerMatches("Bearer abc", undefined)).toBe(false);
  });
});
