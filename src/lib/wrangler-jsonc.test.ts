import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  dashboardCloudflareMetadata,
  simulateD2cParse,
} from "../../scripts/d2c-parse.mjs";
import {
  applyTemplatePlaceholdersForCli,
  DASHBOARD_UUID_RE,
  isPlaceholderDatabaseId,
  loadWrangler,
  TEMPLATE_DATABASE_ID,
} from "../../scripts/resolved-wrangler-config.mjs";

const root = process.cwd();
const wranglerPath = path.join(root, "wrangler.jsonc");

describe("wrangler.jsonc deploy-button compatibility", () => {
  const raw = readFileSync(wranglerPath, "utf8");
  const cfg = JSON.parse(raw) as {
    name: string;
    compatibility_date: string;
    observability?: { enabled?: boolean };
    upload_source_maps?: boolean;
    d1_databases: Array<{
      binding: string;
      database_name: string;
      database_id: string;
      migrations_dir: string;
    }>;
    r2_buckets: Array<{
      binding: string;
      bucket_name: string;
      preview_bucket_name: string;
    }>;
  };

  it("is valid JSON (subset of JSONC; official templates also use JSONC comments)", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw.trim().startsWith("{")).toBe(true);
  });

  it("matches official D2C templates: observability + source maps + D1/R2 defaults", () => {
    expect(cfg.name).toBe("edgedrive");
    expect(cfg.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cfg.observability).toEqual({ enabled: true });
    expect(cfg.upload_source_maps).toBe(true);
    expect(cfg.d1_databases[0]).toMatchObject({
      binding: "DB",
      database_name: "edgedrive-db",
      database_id: TEMPLATE_DATABASE_ID,
      migrations_dir: "migrations",
    });
    expect(cfg.r2_buckets[0]).toMatchObject({
      binding: "FILES",
      bucket_name: "edgedrive",
      preview_bucket_name: "edgedrive",
    });
  });

  it("uses an RFC 4122 v4 UUID, not the nil UUID Zod 3 rejects", () => {
    const id = cfg.d1_databases[0].database_id;
    expect(id).toBe(TEMPLATE_DATABASE_ID);
    expect(DASHBOARD_UUID_RE.test(id)).toBe(true);
    expect(DASHBOARD_UUID_RE.test("00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(DASHBOARD_UUID_RE.test("ffffffff-ffff-ffff-ffff-ffffffffffff")).toBe(false);
    expect(DASHBOARD_UUID_RE.test("151f7d9b-365f-41d7-83ed-0bf4eeef5086")).toBe(true);
  });

  it("loadWrangler matches JSON.parse for the committed file", () => {
    expect(loadWrangler(wranglerPath)).toEqual(JSON.parse(raw));
  });
});

describe("package.json cloudflare metadata", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    cloudflare?: {
      label?: string;
      products?: string[];
      categories?: string[];
      preview_image_url?: string;
      bindings?: Record<string, { description?: string }>;
    };
  };

  it("matches official D2C templates: label + products + categories, no empty preview_image_url", () => {
    expect(pkg.cloudflare?.label).toBe("EdgeDrive");
    expect(pkg.cloudflare?.products).toEqual(["Workers", "D1", "R2"]);
    expect(pkg.cloudflare?.categories).toEqual(["storage"]);
    expect(pkg.cloudflare?.bindings?.DB?.description).toMatch(/D1/);
    expect(pkg.cloudflare?.bindings?.FILES?.description).toMatch(/R2/);
    expect(pkg.cloudflare).not.toHaveProperty("preview_image_url");
    expect(dashboardCloudflareMetadata.safeParse(pkg.cloudflare).success).toBe(true);
  });

  it("rejects the incomplete cloudflare.bindings-only object (R24b) and empty preview_image_url (#14831)", () => {
    expect(
      dashboardCloudflareMetadata.safeParse({
        bindings: { DB: { description: "D1" } },
      }).success,
    ).toBe(false);
    expect(
      dashboardCloudflareMetadata.safeParse({
        label: "EdgeDrive",
        products: ["Workers"],
        categories: ["storage"],
        preview_image_url: "",
      }).success,
    ).toBe(false);
  });
});

describe("local D2C parse simulation", () => {
  it("passes the same parse/validate steps as official d1 / next-starter / r2-explorer templates", () => {
    const wranglerRaw = readFileSync(wranglerPath, "utf8");
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const result = simulateD2cParse({ wranglerRaw, wranglerName: "wrangler.jsonc", pkg });
    expect(result.steps.filter((s) => !s.ok), JSON.stringify(result.steps, null, 2)).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("isPlaceholderDatabaseId", () => {
  it("treats missing, empty, nil, max, and the template v4 UUID as placeholders", () => {
    expect(isPlaceholderDatabaseId(undefined)).toBe(true);
    expect(isPlaceholderDatabaseId(null)).toBe(true);
    expect(isPlaceholderDatabaseId("")).toBe(true);
    expect(isPlaceholderDatabaseId("00000000-0000-0000-0000-000000000000")).toBe(true);
    expect(isPlaceholderDatabaseId("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")).toBe(true);
    expect(isPlaceholderDatabaseId(TEMPLATE_DATABASE_ID)).toBe(true);
  });

  it("keeps a real D1 UUID", () => {
    expect(isPlaceholderDatabaseId("a1b2c3d4-e5f6-4789-8abc-ef1234567890")).toBe(false);
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
      r2_buckets: [
        { binding: "FILES", bucket_name: "prod-bucket", preview_bucket_name: "prod-bucket" },
      ],
    };
    expect(applyTemplatePlaceholdersForCli(cfg)).toBe(false);
    expect(cfg.d1_databases[0].database_id).toBe("11111111-2222-4333-8444-555555555555");
    expect(cfg.d1_databases[0].database_name).toBe("prod-db");
    expect(cfg.r2_buckets[0].bucket_name).toBe("prod-bucket");
    expect(cfg.r2_buckets[0].preview_bucket_name).toBe("prod-bucket");
  });
});
