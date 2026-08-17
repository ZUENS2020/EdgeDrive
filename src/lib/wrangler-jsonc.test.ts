import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyTemplatePlaceholdersForCli,
  isPlaceholderDatabaseId,
  loadWrangler,
} from "../../scripts/resolved-wrangler-config.mjs";

const root = process.cwd();
const wranglerPath = path.join(root, "wrangler.jsonc");

describe("wrangler.jsonc deploy-button compatibility", () => {
  const raw = readFileSync(wranglerPath, "utf8");

  it("is valid JSON (Cloudflare deploy-button frontend uses JSON.parse, not JSONC)", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw).not.toMatch(/^\s*\/\//m);
    expect(raw).not.toMatch(/\/\*/);
    expect(raw.trim().startsWith("{")).toBe(true);
  });

  it("declares default D1/R2 names and a placeholder database_id", () => {
    const cfg = JSON.parse(raw) as {
      name: string;
      compatibility_date: string;
      d1_databases: Array<{
        binding: string;
        database_name: string;
        database_id: string;
        migrations_dir: string;
      }>;
      r2_buckets: Array<{ binding: string; bucket_name: string }>;
    };
    expect(cfg.name).toBe("edgedrive");
    expect(cfg.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cfg.d1_databases[0]).toMatchObject({
      binding: "DB",
      database_name: "edgedrive-db",
      database_id: "00000000-0000-0000-0000-000000000000",
      migrations_dir: "migrations",
    });
    expect(cfg.r2_buckets[0]).toMatchObject({
      binding: "FILES",
      bucket_name: "edgedrive",
    });
  });

  it("loadWrangler matches JSON.parse for the committed file", () => {
    expect(loadWrangler(wranglerPath)).toEqual(JSON.parse(raw));
  });
});

describe("isPlaceholderDatabaseId", () => {
  it("treats missing, empty, and nil UUIDs as placeholders", () => {
    expect(isPlaceholderDatabaseId(undefined)).toBe(true);
    expect(isPlaceholderDatabaseId(null)).toBe(true);
    expect(isPlaceholderDatabaseId("")).toBe(true);
    expect(isPlaceholderDatabaseId("00000000-0000-0000-0000-000000000000")).toBe(true);
    expect(isPlaceholderDatabaseId("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")).toBe(true);
  });

  it("keeps a real D1 UUID", () => {
    expect(isPlaceholderDatabaseId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(false);
  });
});

describe("applyTemplatePlaceholdersForCli", () => {
  it("strips template D1/R2 fields so wrangler can inherit or auto-create", () => {
    const cfg = loadWrangler(wranglerPath);
    expect(applyTemplatePlaceholdersForCli(cfg)).toBe(true);
    expect(cfg.d1_databases[0]).toEqual({
      binding: "DB",
      migrations_dir: "migrations",
    });
    expect(cfg.r2_buckets[0]).toEqual({ binding: "FILES" });
    expect(applyTemplatePlaceholdersForCli(cfg)).toBe(false);
  });

  it("keeps a real database_id and the matching resource names", () => {
    const cfg = {
      d1_databases: [
        {
          binding: "DB",
          database_name: "prod-db",
          database_id: "11111111-2222-4333-8444-555555555555",
          migrations_dir: "migrations",
        },
      ],
      r2_buckets: [{ binding: "FILES", bucket_name: "prod-bucket" }],
    };
    expect(applyTemplatePlaceholdersForCli(cfg)).toBe(false);
    expect(cfg.d1_databases[0].database_id).toBe("11111111-2222-4333-8444-555555555555");
    expect(cfg.d1_databases[0].database_name).toBe("prod-db");
    expect(cfg.r2_buckets[0].bucket_name).toBe("prod-bucket");
  });
});
