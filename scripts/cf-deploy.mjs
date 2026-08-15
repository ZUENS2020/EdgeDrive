#!/usr/bin/env node
/**
 * Local `npm run cf-deploy` / optional Workers Builds deploy command.
 * Assumes the OpenNext build already produced `.open-next/`.
 *
 * 1. wrangler deploy（已有 DB/FILES 就沿用；没有则自动建；若默认名资源已存在则绑上）
 * 2. 对绑定名 DB 跑远程迁移
 * 3. 种齐 Variables and Secrets 字段名（已有值不覆盖）
 *
 * OPEN_NEXT_DEPLOY 避免 wrangler 再包一层 `opennextjs-cloudflare deploy`。
 * EDGEDRIVE_INNER_WRANGLER 避免 postinstall 包装过的 wrangler 再进本脚本。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { resolvedWranglerConfigPath } from "./resolved-wrangler-config.mjs";

const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");
const env = {
  ...process.env,
  OPEN_NEXT_DEPLOY: "true",
  EDGEDRIVE_INNER_WRANGLER: "1",
};

function run(bin, args) {
  const result = spawnSync(bin, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const configPath = await resolvedWranglerConfigPath();
const configArgs = path.basename(configPath) === "wrangler.jsonc" ? [] : ["--config", configPath];
env.CF_WRANGLER_CONFIG = configPath;

run(wranglerBin, ["deploy", "--keep-vars", ...configArgs]);
run(process.execPath, [path.join(process.cwd(), "scripts", "d1-migrate-remote.mjs")]);

const seed = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "ensure-optional-secrets.mjs")], {
  stdio: "inherit",
  env,
});
if (seed.status !== 0) {
  console.warn("dashboard secret names were not seeded; add them in Dashboard → Variables and Secrets");
}
