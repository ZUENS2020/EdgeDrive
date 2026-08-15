#!/usr/bin/env node
/**
 * Cloudflare Workers Builds deploy step (and local `npm run cf-deploy`).
 * Assumes the OpenNext build already produced `.open-next/`.
 *
 * OPEN_NEXT_DEPLOY 避免 wrangler 再包一层 `opennextjs-cloudflare deploy`。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");
const env = {
  ...process.env,
  OPEN_NEXT_DEPLOY: "true",
};

function run(bin, args) {
  const result = spawnSync(bin, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [path.join(process.cwd(), "scripts", "d1-migrate-remote.mjs")]);
run(wranglerBin, ["deploy", "--keep-vars"]);

const seed = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "ensure-optional-secrets.mjs")], {
  stdio: "inherit",
  env,
});
if (seed.status !== 0) {
  console.warn("optional CLOUDFLARE_* secrets were not seeded; add them in Dashboard → Variables and Secrets");
}
