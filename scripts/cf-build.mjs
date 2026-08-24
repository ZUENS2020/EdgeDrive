#!/usr/bin/env node
/**
 * Cloudflare Workers Builds 默认跑 `npm run build`。
 * 这里走 OpenNext；OpenNext 编 Next 时用 open-next.config.ts 的
 * `buildCommand: npx next build`，避免再套一层 `npm run build`。
 * FLAG 是双保险：万一内部仍调用本脚本，内层只跑 next。
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FLAG = "EDGEDRIVE_INNER_NEXT_BUILD";
const env = { ...process.env };
const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
const opennextBin = path.join(process.cwd(), "node_modules", ".bin", "opennextjs-cloudflare");

function run(bin, args) {
  const result = spawnSync(bin, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function writeBootstrapSql() {
  run(process.execPath, [path.join(process.cwd(), "scripts/generate-bootstrap.mjs")]);
}

function injectScheduledHandler() {
  const workerPath = path.join(process.cwd(), ".open-next/worker.js");
  const marker = "async scheduled(";
  const src = readFileSync(workerPath, "utf8");
  if (src.includes(marker)) return;
  const needle = "export default {\n    async fetch(request, env, ctx) {";
  if (!src.includes(needle)) {
    throw new Error(
      "OpenNext worker.js structure changed; cannot inject cron scheduled handler. Update scripts/cf-build.mjs.",
    );
  }
  const injected = src.replace(
    needle,
    `export default {
    async scheduled(event, env, ctx) {
        let secret = String(env.CRON_SECRET || "").trim();
        if (!secret && env.DB) {
            const row = await env.DB.prepare("SELECT cron_secret FROM app_settings WHERE id = 1").first();
            secret = String(row?.cron_secret || "").trim();
        }
        if (!secret) {
            console.warn("[edgedrive] scheduled purge skipped: cron_secret missing");
            return;
        }
        const request = new Request("https://edgedrive.internal/api/cron/purge", {
            method: "GET",
            headers: { Authorization: "Bearer " + secret },
        });
        return this.fetch(request, env, ctx);
    },
    async fetch(request, env, ctx) {`,
  );
  writeFileSync(workerPath, injected);
}

if (env[FLAG] === "1") {
  run(nextBin, ["build"]);
  process.exit(0);
}

writeBootstrapSql();
env[FLAG] = "1";
run(opennextBin, ["build"]);
injectScheduledHandler();
