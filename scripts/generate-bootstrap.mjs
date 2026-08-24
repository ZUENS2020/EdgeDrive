#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "migrations-v2");
const leadingMigrationNumber = (name) => Number(name.match(/^(\d+)/)?.[1] || 0);
const files = readdirSync(dir)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort((a, b) => leadingMigrationNumber(a) - leadingMigrationNumber(b) || a.localeCompare(b));
const sql = files.map((name) => readFileSync(path.join(dir, name), "utf8")).join("\n");
const expected = files.reduce((max, name) => Math.max(max, leadingMigrationNumber(name)), 0);
const output = `/** Generated from migrations-v2/*.sql. Do not edit by hand. */\nexport const EXPECTED_SCHEMA_VERSION = ${expected};\nexport const D1_BOOTSTRAP_SQL = ${JSON.stringify(sql)};\n`;
const target = path.join(root, "src/lib/d1-bootstrap-sql.ts");
if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8");
  if (current !== output) {
    console.error("src/lib/d1-bootstrap-sql.ts is stale; run npm run schema:generate");
    process.exit(1);
  }
} else {
  writeFileSync(target, output);
}
