import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Bundle migrations/*.sql for the empty-D1 runtime bootstrap. */
export function writeD1BootstrapSql(cwd = process.cwd()) {
  const dir = path.join(cwd, "migrations");
  const files = readdirSync(dir)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
  const sql = files.map((name) => readFileSync(path.join(dir, name), "utf8")).join("\n");
  const out = path.join(cwd, "src/lib/d1-bootstrap-sql.ts");
  writeFileSync(
    out,
    `/** Generated from migrations/*.sql by scripts/write-d1-bootstrap-sql.mjs. Do not edit by hand. */\nexport const D1_BOOTSTRAP_SQL = ${JSON.stringify(sql)};\n`,
  );
}
