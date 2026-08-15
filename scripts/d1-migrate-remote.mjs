#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");

function loadWrangler() {
  const raw = readFileSync(path.join(process.cwd(), "wrangler.jsonc"), "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

const d1Name = loadWrangler()?.d1_databases?.[0]?.database_name;
if (!d1Name) {
  console.error("Set d1_databases[0].database_name in wrangler.jsonc before deploying.");
  process.exit(1);
}

const result = spawnSync(wranglerBin, ["d1", "migrations", "apply", d1Name, "--remote"], {
  stdio: "inherit",
  env: process.env,
});
if (result.status !== 0) process.exit(result.status ?? 1);
