#!/usr/bin/env node
/**
 * Apply remote D1 migrations using the binding name (default DB).
 * After auto-provision / Dashboard inherit, wrangler resolves the real database.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");

function loadWrangler() {
  const raw = readFileSync(path.join(process.cwd(), "wrangler.jsonc"), "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

const d1 = loadWrangler()?.d1_databases?.[0];
const target = d1?.database_name || d1?.binding;
if (!target) {
  console.error("Set d1_databases[0].binding in wrangler.jsonc before migrating.");
  process.exit(1);
}

const result = spawnSync(wranglerBin, ["d1", "migrations", "apply", target, "--remote"], {
  stdio: "inherit",
  env: process.env,
});
if (result.status !== 0) process.exit(result.status ?? 1);
