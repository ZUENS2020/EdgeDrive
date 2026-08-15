#!/usr/bin/env node
/**
 * Cloudflare 创建 Worker 时往往只让填构建命令，部署固定为 `npx wrangler deploy`。
 * 拦截 deploy / versions upload，改走 scripts/cf-deploy.mjs（绑资源、迁移、种密钥名）。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wranglerJs } from "./wrangler-bin.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const isDeploy = args[0] === "deploy";
const isUpload = args[0] === "versions" && args[1] === "upload";
const inner = process.env.EDGEDRIVE_INNER_WRANGLER === "1";
const dryRun = args.includes("--dry-run");

if (isDeploy && !inner && !dryRun) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "cf-deploy.mjs")], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  process.exit(result.status ?? 1);
}

function hasFlag(name) {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

if ((isDeploy || isUpload) && !dryRun) {
  if (!hasFlag("--keep-vars") && !hasFlag("--no-keep-vars")) args.push("--keep-vars");
}

const result = spawnSync(process.execPath, [wranglerJs, ...args], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});
if (result.status !== 0) process.exit(result.status ?? 1);

if (isUpload && !inner && !dryRun) {
  const migrate = spawnSync(process.execPath, [path.join(root, "scripts/d1-migrate-remote.mjs")], {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);
  const seed = spawnSync(process.execPath, [path.join(root, "scripts/ensure-optional-secrets.mjs")], {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  });
  if (seed.status !== 0) {
    console.warn("dashboard secret names were not seeded; add them in Dashboard → Variables and Secrets");
  }
}
