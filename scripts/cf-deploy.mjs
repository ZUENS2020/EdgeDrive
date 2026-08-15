#!/usr/bin/env node
/**
 * Cloudflare Workers Builds deploy step (and local `npm run cf-deploy`).
 * Assumes `npm run cf-build` already produced `.open-next/`.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");
const env = {
  ...process.env,
  OPEN_NEXT_DEPLOY: "true",
};

function loadWrangler() {
  const raw = readFileSync(path.join(process.cwd(), "wrangler.jsonc"), "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

function run(bin, args) {
  const result = spawnSync(bin, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const wrangler = loadWrangler();
const d1Name = wrangler?.d1_databases?.[0]?.database_name;
if (!d1Name) {
  console.error("Set d1_databases[0].database_name in wrangler.jsonc before deploying.");
  process.exit(1);
}

run(wranglerBin, ["d1", "migrations", "apply", d1Name, "--remote"]);
run(wranglerBin, ["deploy", "--keep-vars"]);

const seed = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "ensure-optional-secrets.mjs")], {
  stdio: "inherit",
  env,
});
if (seed.status !== 0) {
  console.warn("optional CLOUDFLARE_* secrets were not seeded; add them in Dashboard → Variables and Secrets");
}
