#!/usr/bin/env node
/**
 * Workers Builds 默认会跑 `npm run build`。这里必须走 OpenNext，
 * 不能用 `next build`，否则下一步 wrangler deploy 找不到 Worker 产物。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const env = { ...process.env };
const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");
const opennextBin = path.join(process.cwd(), "node_modules", ".bin", "opennextjs-cloudflare");

function run(bin, args) {
  const result = spawnSync(bin, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(opennextBin, ["build"]);

if (process.env.WORKERS_CI === "1") {
  run(process.execPath, [path.join(process.cwd(), "scripts", "d1-migrate-remote.mjs")]);
}
