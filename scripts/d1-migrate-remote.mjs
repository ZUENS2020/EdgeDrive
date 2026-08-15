#!/usr/bin/env node
/**
 * Apply remote D1 migrations using the binding name (default DB).
 * After auto-provision / Dashboard inherit, wrangler resolves the real database.
 * When cf-deploy wrote wrangler.resolved.json, reuse that config so the ID is known.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");

function loadWrangler(file) {
  const raw = readFileSync(file, "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

const configPath =
  process.env.CF_WRANGLER_CONFIG ||
  (existsSync("wrangler.resolved.json")
    ? path.join(process.cwd(), "wrangler.resolved.json")
    : path.join(process.cwd(), "wrangler.jsonc"));
const configArgs = path.basename(configPath) === "wrangler.jsonc" ? [] : ["--config", configPath];

const d1 = loadWrangler(configPath)?.d1_databases?.[0];
const target = d1?.database_name || d1?.binding;
if (!target) {
  console.error("Set d1_databases[0].binding in wrangler.jsonc before migrating.");
  process.exit(1);
}

const result = spawnSync(
  wranglerBin,
  ["d1", "migrations", "apply", target, "--remote", ...configArgs],
  {
    stdio: "inherit",
    env: process.env,
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
