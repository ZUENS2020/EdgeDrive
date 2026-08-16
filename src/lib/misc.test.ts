import { describe, expect, it } from "vitest";
import { evaluateSchemaVersion, missingCoreTables } from "./d1-bootstrap";
import { D1_BOOTSTRAP_SQL, EXPECTED_SCHEMA_VERSION } from "./d1-bootstrap-sql";
import { shouldCountDownload } from "./download-policy";
import { cfApiTokenConfigured, readEnvSecret } from "./cf-credentials";
import { bearerMatches } from "./cron-auth";
import { fileExpiryLabel } from "./format";

describe("d1 schema helpers", () => {
  it("lists missing core tables", () => {
    expect(missingCoreTables(["files", "settings"])).toContain("folders");
    expect(missingCoreTables(["files", "folders", "settings"])).toEqual([]);
  });

  it("treats missing version as untracked and old as stale", () => {
    expect(EXPECTED_SCHEMA_VERSION).toBe(10);
    expect(evaluateSchemaVersion(undefined, 10)).toBe("untracked");
    expect(evaluateSchemaVersion("", 10)).toBe("untracked");
    expect(evaluateSchemaVersion("9", 10)).toBe("stale");
    expect(evaluateSchemaVersion("10", 10)).toBe("ok");
    expect(evaluateSchemaVersion("11", 10)).toBe("ok");
  });

  it("bootstrap SQL includes batch_links (migration 0010)", () => {
    expect(D1_BOOTSTRAP_SQL).toContain("CREATE TABLE IF NOT EXISTS batch_links");
    expect(D1_BOOTSTRAP_SQL).toContain("idx_batch_expires");
    expect(D1_BOOTSTRAP_SQL).toMatch(/schema_version', '10'/);
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

describe("fileExpiryLabel", () => {
  it("labels permanent, expired, and dated files", () => {
    const now = Date.parse("2026-08-16T00:00:00.000Z");
    expect(fileExpiryLabel(null, now)).toBe("永久");
    expect(fileExpiryLabel("2026-08-15T00:00:00.000Z", now)).toBe("已过期");
    expect(fileExpiryLabel("2026-09-01T08:30:00.000Z", now)).toMatch(/^有效期至 /);
  });
});
