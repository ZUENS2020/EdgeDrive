#!/usr/bin/env node
/**
 * OpenNext inner Next.js build. Used as open-next.config.ts `buildCommand`
 * so both `npm run build` and `npx opennextjs-cloudflare build` generate
 * the D1 bootstrap SQL before compiling.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { writeD1BootstrapSql } from "./write-d1-bootstrap-sql.mjs";

writeD1BootstrapSql();

const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
const result = spawnSync(nextBin, ["build"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
