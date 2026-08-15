#!/usr/bin/env node
/**
 * If a previous deploy created D1/R2 with Wrangler's default names but never
 * bound them to the Worker, a later deploy with auto-create tries to create
 * the same names and fails. Fill IDs from those existing resources for this
 * deploy only — the committed wrangler.jsonc stays names-only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function loadWrangler(file) {
  const raw = readFileSync(file, "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
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
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) return src;

  const cfg = loadWrangler(src);
  const scriptName = cfg.name;
  if (!scriptName) return src;

  let settings;
  try {
    settings = await cfApi(account, token, `/workers/scripts/${scriptName}/settings`);
  } catch {
    settings = { bindings: [] };
  }
  const bound = new Set((settings?.bindings || []).map((b) => b.name));

  const d1 = cfg.d1_databases?.[0];
  const r2 = cfg.r2_buckets?.[0];
  let changed = false;

  if (d1?.binding && !d1.database_id && !bound.has(d1.binding)) {
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
  }

  if (r2?.binding && !r2.bucket_name && !bound.has(r2.binding)) {
    const want = defaultResourceName(scriptName, r2.binding);
    const list = await cfApi(account, token, "/r2/buckets");
    const buckets = list?.buckets || list || [];
    const hit = (Array.isArray(buckets) ? buckets : []).find((b) => b.name === want);
    if (hit?.name) {
      r2.bucket_name = hit.name;
      changed = true;
      console.log(`using existing R2 ${hit.name} for ${r2.binding}`);
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
