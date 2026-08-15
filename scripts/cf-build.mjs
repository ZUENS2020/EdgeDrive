#!/usr/bin/env node
/**
 * Cloudflare Workers Builds 默认跑 `npm run build`。
 * 这里走 OpenNext；OpenNext 编 Next 时用 open-next.config.ts 的
 * `buildCommand: npx next build`，避免再套一层 `npm run build`。
 * FLAG 是双保险：万一内部仍调用本脚本，内层只跑 next。
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
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
  const dir = path.join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
  const sql = files.map((name) => readFileSync(path.join(dir, name), "utf8")).join("\n");
  const out = path.join(process.cwd(), "src/lib/d1-bootstrap-sql.ts");
  writeFileSync(
    out,
    `/** Generated from migrations/*.sql by scripts/cf-build.mjs. Do not edit by hand. */\nexport const D1_BOOTSTRAP_SQL = ${JSON.stringify(sql)};\n`,
  );
}

if (env[FLAG] === "1") {
  run(nextBin, ["build"]);
  process.exit(0);
}

writeBootstrapSql();
env[FLAG] = "1";
run(opennextBin, ["build"]);
