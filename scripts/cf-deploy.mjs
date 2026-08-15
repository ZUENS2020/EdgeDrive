#!/usr/bin/env node
/**
 * Local `npm run cf-deploy`. Workers Builds can keep whatever command
 * Cloudflare auto-fills (`npx wrangler deploy` or
 * `npx opennextjs-cloudflare deploy`) — the wrangler shim adds the same
 * flags and post-steps.
 *
 * OPEN_NEXT_DEPLOY 避免 wrangler 再包一层 `opennextjs-cloudflare deploy`。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { wranglerJs } from "./wrangler-bin.mjs";

const env = {
  ...process.env,
  OPEN_NEXT_DEPLOY: "true",
  DL_PLATFORM_CF_DEPLOY: "1",
};

function run(bin, args, extraEnv = env) {
  const result = spawnSync(bin, args, { stdio: "inherit", env: extraEnv });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [wranglerJs, "deploy", "--keep-vars", "--x-auto-create=false"]);
run(process.execPath, [path.join(process.cwd(), "scripts", "d1-migrate-remote.mjs")]);

const seed = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "ensure-optional-secrets.mjs")], {
  stdio: "inherit",
  env,
});
if (seed.status !== 0) {
  console.warn("dashboard secret names were not seeded; add them in Dashboard → Variables and Secrets");
}
