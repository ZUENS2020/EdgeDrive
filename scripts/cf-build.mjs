#!/usr/bin/env node
/**
 * Cloudflare Workers Builds 可能填 `npm run build` 或
 * `npx opennextjs-cloudflare build`。两者都走到 OpenNext；
 * 内层 Next 由 open-next.config.ts 的 buildCommand 执行。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const opennextBin = path.join(process.cwd(), "node_modules", ".bin", "opennextjs-cloudflare");
const result = spawnSync(opennextBin, ["build"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
