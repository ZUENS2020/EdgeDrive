#!/usr/bin/env node
/**
 * Local `npm run cf-deploy` / optional Workers Builds deploy command.
 * Assumes the OpenNext build already produced `.open-next/`.
 *
 * 1. wrangler deploy（沿用 Dashboard Bindings 里已有的 D1/R2，不自动建新的）
 * 2. 对绑定名 DB 跑远程迁移
 * 3. 种齐 Variables and Secrets 字段名（已有值不覆盖）
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

run(wranglerBin, ["deploy", "--keep-vars", "--x-auto-create=false"]);
run(process.execPath, [path.join(process.cwd(), "scripts", "d1-migrate-remote.mjs")]);

const seed = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "ensure-optional-secrets.mjs")], {
  stdio: "inherit",
  env,
});
if (seed.status !== 0) {
  console.warn("dashboard secret names were not seeded; add them in Dashboard → Variables and Secrets");
}
