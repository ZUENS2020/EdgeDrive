#!/usr/bin/env node
/**
 * Committed wrangler.jsonc is a Deploy-to-Cloudflare template: default D1/R2
 * names plus an RFC 4122 v4 UUID (not the nil UUID). Wrangler CLI must not see
 * that UUID (it would skip auto-provision and try to bind a fake database).
 *
 * This module:
 * 1. Strips template placeholders so deploy inherits existing bindings / auto-creates
 * 2. If a previous deploy created default-named D1/R2 but never bound them,
 *    fills those IDs for this deploy only
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Same string as wrangler.jsonc d1_databases[0].database_id. Valid v4, not nil. */
export const TEMPLATE_DATABASE_ID = "7c3e1f2a-9b4d-4a6e-8c1f-2d5e8a7b0c13";

/**
 * Zod 3 `z.string().uuid()` (versions 1–5 + RFC variant). Dashboard parsers that
 * still use this reject the nil UUID that current Wrangler/Zod 4 special-cases.
 */
export const DASHBOARD_UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export const PLACEHOLDER_DATABASE_IDS = new Set([
  TEMPLATE_DATABASE_ID,
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
]);

export function loadWrangler(file) {
  const raw = readFileSync(file, "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

export function isPlaceholderDatabaseId(id) {
  if (id == null || id === "") return true;
  if (typeof id !== "string") return true;
  return PLACEHOLDER_DATABASE_IDS.has(id.toLowerCase());
}

/**
 * Dashboard parsers want database_name / database_id / bucket_name present.
 * Wrangler CLI wants those omitted (or real) so it can inherit / auto-create.
 * Mutates cfg; returns whether anything changed.
 */
export function applyTemplatePlaceholdersForCli(cfg) {
  let changed = false;
  const d1 = cfg.d1_databases?.[0];
  const r2 = cfg.r2_buckets?.[0];
  const realD1 = d1 && !isPlaceholderDatabaseId(d1.database_id);

  if (d1 && !realD1 && "database_id" in d1) {
    delete d1.database_id;
    changed = true;
  }
  if (d1 && !d1.database_id && "database_name" in d1) {
    delete d1.database_name;
    changed = true;
  }
  if (r2 && !d1?.database_id && "bucket_name" in r2) {
    delete r2.bucket_name;
    changed = true;
  }
  if (r2 && !d1?.database_id && "preview_bucket_name" in r2) {
    delete r2.preview_bucket_name;
    changed = true;
  }
  return changed;
}

async function cfApi(account, token, pathname) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) {
    const err = (body.errors || []).map((e) => e.message).join("; ") || res.statusText;
    throw new Error(`Cloudflare API ${pathname}: ${err}`);
  }
  return body.result;
}

function defaultResourceName(scriptName, binding) {
  return `${scriptName}-${binding.toLowerCase().replaceAll("_", "-")}`;
}

export async function resolvedWranglerConfigPath(root = process.cwd()) {
  const src = path.join(root, "wrangler.jsonc");
  const cfg = loadWrangler(src);
  let changed = applyTemplatePlaceholdersForCli(cfg);

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const scriptName = cfg.name;

  if (token && account && scriptName) {
    let settings;
    try {
      settings = await cfApi(account, token, `/workers/scripts/${scriptName}/settings`);
    } catch (err) {
      console.warn(`could not read Worker settings (${err.message}); will match default-named D1/R2 if unbound`);
      settings = { bindings: [] };
    }
    const bound = new Set((settings?.bindings || []).map((b) => b.name));

    const d1 = cfg.d1_databases?.[0];
    const r2 = cfg.r2_buckets?.[0];

    if (d1?.binding && !d1.database_id && !bound.has(d1.binding)) {
      try {
        const want = d1.database_name || defaultResourceName(scriptName, d1.binding);
        const list = await cfApi(account, token, "/d1/database");
        const hit = (Array.isArray(list) ? list : list?.result || []).find((db) => db.name === want);
        const uuid = hit?.uuid || hit?.id;
        if (uuid) {
          d1.database_name = want;
          d1.database_id = uuid;
          changed = true;
          console.log(`using existing D1 ${want} for ${d1.binding}`);
        }
      } catch (err) {
        console.warn(`could not list D1 (${err.message}); leaving ${d1.binding} for wrangler auto-create`);
      }
    }

    if (r2?.binding && !r2.bucket_name && !bound.has(r2.binding)) {
      try {
        const want = defaultResourceName(scriptName, r2.binding);
        const list = await cfApi(account, token, "/r2/buckets");
        const buckets = list?.buckets || list || [];
        const hit = (Array.isArray(buckets) ? buckets : []).find((b) => b.name === want);
        if (hit?.name) {
          r2.bucket_name = hit.name;
          changed = true;
          console.log(`using existing R2 ${hit.name} for ${r2.binding}`);
        }
      } catch (err) {
        console.warn(`could not list R2 (${err.message}); leaving ${r2.binding} for wrangler auto-create`);
      }
    }
  }

  if (!changed) return src;

  const out = path.join(root, "wrangler.resolved.json");
  writeFileSync(out, `${JSON.stringify(cfg, null, 2)}\n`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = await resolvedWranglerConfigPath();
  console.log(p);
}
