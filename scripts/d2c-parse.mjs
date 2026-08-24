#!/usr/bin/env node
/**
 * Local replica of the Deploy-to-Cloudflare parse/validate path.
 *
 * Evidence (not guesses):
 * - deploy.workers.cloudflare.com redirects into the dashboard create flow.
 *   Failures surface as “There was a problem parsing the Wrangler configuration
 *   file” even when the fault is package.json metadata
 *   (workers-sdk#14831, POST /api/v4/workers/template-from-worker).
 * - Official templates (cloudflare/templates) parse wrangler JSONC with
 *   `comment-json` (cli/src/util.ts readJsonC). Wrangler CLI uses jsonc-parser
 *   with comments + trailing commas allowed for .jsonc.
 * - Official package.json `cloudflare` objects always include `label`,
 *   `products`, `categories`. templates/cli/src/lint.ts requires those three
 *   whenever `cloudflare` is present. preview_image_url, if present, must be a
 *   real URL — empty string is the 14831 failure.
 * - Wrangler config is then checked against wrangler’s published JSON Schema
 *   (additionalProperties: false) and D1 database_id against Zod 3 uuid
 *   (version 1–5 + RFC variant). The dashboard still uses that uuid() shape;
 *   Wrangler/Zod 4 additionally allow the nil UUID.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseCommentJson } from "comment-json";
import Ajv from "ajv";
import { z } from "zod";
import { DASHBOARD_UUID_RE, TEMPLATE_DATABASE_ID } from "./resolved-wrangler-config.mjs";

const D2C_CATEGORIES = ["starter", "storage", "ai"];

/** Zod 3 `z.string().uuid()` — dashboard parsers that have not moved to Zod 4. */
export const dashboardUuid = z.string().regex(DASHBOARD_UUID_RE, "Zod 3 uuid()");

/**
 * package.json `cloudflare` block as used by the D2C / template-from-worker
 * path. Unknown keys are stripped (official templates also send healthCheckPath).
 * `.strict()` is NOT used — x402-proxy-template would fail it.
 */
export const dashboardCloudflareMetadata = z.object({
  label: z.string().min(1),
  products: z.array(z.string()),
  categories: z.array(z.enum(D2C_CATEGORIES)),
  preview_image_url: z.string().url().optional(),
  preview_icon_url: z.string().url().optional(),
  icon_urls: z.array(z.string()).optional(),
  publish: z.boolean().optional(),
  docs_url: z.string().url().optional(),
  bindings: z
    .record(z.string(), z.object({ description: z.string() }))
    .optional(),
});

function wranglerLikeJsoncParse(raw, filename) {
  const errors = [];
  try {
    JSON.parse(raw);
  } catch (err) {
    errors.push(`JSON.parse: ${err.message}`);
  }
  try {
    parseCommentJson(raw);
  } catch (err) {
    errors.push(`comment-json (official templates): ${err.message}`);
  }
  if (filename.endsWith(".json") && /\/\*[\s\S]*?\*\/|^\s*\/\//m.test(raw)) {
    errors.push("wrangler.json forbids comments (dashboard parseJSON disallowComments)");
  }
  return errors;
}

function loadJsoncObject(raw) {
  return parseCommentJson(raw, null, true);
}

function validateWranglerSchema(cfg) {
  const schemaPath = path.join(process.cwd(), "node_modules/wrangler/config-schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  });
  const validate = ajv.compile(schema);
  const ok = validate(cfg);
  return ok ? [] : (validate.errors || []).map((e) => `${e.instancePath || "/"} ${e.message}`);
}

function validateD1Ids(cfg) {
  const errors = [];
  for (const [i, db] of (cfg.d1_databases || []).entries()) {
    if (db.database_id == null || db.database_id === "") {
      errors.push(`d1_databases[${i}].database_id missing (D2C docs require a default id)`);
      continue;
    }
    const parsed = dashboardUuid.safeParse(db.database_id);
    if (!parsed.success) {
      errors.push(
        `d1_databases[${i}].database_id ${JSON.stringify(db.database_id)} fails Zod 3 uuid()`,
      );
    }
  }
  return errors;
}

function validateR2(cfg) {
  const errors = [];
  for (const [i, bucket] of (cfg.r2_buckets || []).entries()) {
    if (!bucket.bucket_name) {
      errors.push(`r2_buckets[${i}].bucket_name missing (D2C docs require a default name)`);
    }
  }
  return errors;
}

export function validateCloudflareMetadata(cloudflare) {
  if (cloudflare === undefined) return [];
  const parsed = dashboardCloudflareMetadata.safeParse(cloudflare);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => `cloudflare.${i.path.join(".") || "(root)"}: ${i.message}`);
}

export function simulateD2cParse({ wranglerRaw, wranglerName, pkg }) {
  const steps = [];
  const jsoncErrors = wranglerLikeJsoncParse(wranglerRaw, wranglerName);
  steps.push({
    step: "1.parse wrangler JSONC (comment-json + JSON.parse)",
    ok: jsoncErrors.length === 0 || (jsoncErrors.length === 1 && jsoncErrors[0].startsWith("JSON.parse") && wranglerName.endsWith(".jsonc")),
    errors: jsoncErrors.filter((e) => !(wranglerName.endsWith(".jsonc") && e.startsWith("JSON.parse"))),
  });

  let cfg;
  try {
    cfg = loadJsoncObject(wranglerRaw);
  } catch (err) {
    steps.push({ step: "1b.load object", ok: false, errors: [err.message] });
    return { ok: false, steps };
  }

  const schemaErrors = validateWranglerSchema(cfg);
  steps.push({ step: "2.AJV wrangler config-schema.json", ok: schemaErrors.length === 0, errors: schemaErrors });

  const d1Errors = validateD1Ids(cfg);
  steps.push({ step: "3.D1 database_id Zod 3 uuid()", ok: d1Errors.length === 0, errors: d1Errors });

  const r2Errors = validateR2(cfg);
  steps.push({ step: "4.R2 bucket_name present", ok: r2Errors.length === 0, errors: r2Errors });

  const metaErrors = validateCloudflareMetadata(pkg?.cloudflare);
  steps.push({
    step: "5.package.json cloudflare metadata (template-from-worker)",
    ok: metaErrors.length === 0,
    errors: metaErrors,
  });

  if (pkg?.cloudflare && Object.prototype.hasOwnProperty.call(pkg.cloudflare, "preview_image_url")) {
    const url = pkg.cloudflare.preview_image_url;
    if (url === "") {
      steps.push({
        step: "5b.preview_image_url empty string (workers-sdk#14831)",
        ok: false,
        errors: ["empty preview_image_url is reported as a Wrangler parse error"],
      });
    }
  }

  const ok = steps.every((s) => s.ok);
  return { ok, steps, cfg, templateDatabaseId: TEMPLATE_DATABASE_ID };
}

function readRepo(root) {
  const wranglerJsonc = path.join(root, "wrangler.jsonc");
  const wranglerJson = path.join(root, "wrangler.json");
  const wranglerName = exists(wranglerJsonc) ? "wrangler.jsonc" : "wrangler.json";
  const wranglerPath = path.join(root, wranglerName);
  return {
    wranglerRaw: readFileSync(wranglerPath, "utf8"),
    wranglerName,
    pkg: JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")),
  };
}

function exists(p) {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(process.argv[2] || process.cwd());
  const result = simulateD2cParse(readRepo(root));
  for (const step of result.steps) {
    const mark = step.ok ? "PASS" : "FAIL";
    console.log(`[${mark}] ${step.step}`);
    for (const err of step.errors) console.log(`       ${err}`);
  }
  process.exit(result.ok ? 0 : 1);
}
