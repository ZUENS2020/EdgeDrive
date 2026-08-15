#!/usr/bin/env node
/**
 * Cloudflare Workers Builds 默认跑 `npm run build`。
 * OpenNext 编 Worker 时会再跑一次 `npm run build`（编 Next）。
 * 内层只执行 `next build`，避免套娃。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const FLAG = "DL_PLATFORM_INNER_NEXT_BUILD";
const env = { ...process.env };
const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
const opennextBin = path.join(process.cwd(), "node_modules", ".bin", "opennextjs-cloudflare");

function run(bin, args) {
  const result = spawnSync(bin, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (env[FLAG] === "1") {
  run(nextBin, ["build"]);
  process.exit(0);
}

env[FLAG] = "1";
run(opennextBin, ["build"]);

if (process.env.WORKERS_CI === "1") {
  run(process.execPath, [path.join(process.cwd(), "scripts", "d1-migrate-remote.mjs")]);
}
