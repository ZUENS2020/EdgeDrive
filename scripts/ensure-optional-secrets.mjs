#!/usr/bin/env node
/**
 * After wrangler deploy, create Encrypted Secrets that should show up in
 * Dashboard but are optional at runtime. Existing secrets are never overwritten.
 *
 * Sentinel value NULL is treated as unset by envString().
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const KEYS = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"];
const SENTINEL = "NULL";
const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");
const env = { ...process.env, WRANGLER_LOG: process.env.WRANGLER_LOG || "error" };

function wrangler(args, { input, inherit } = {}) {
  const result = spawnSync(wranglerBin, args, {
    encoding: "utf8",
    input,
    stdio: inherit ? ["pipe", "inherit", "inherit"] : ["ignore", "pipe", "pipe"],
    env,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim() || `wrangler ${args.join(" ")} failed`;
    throw new Error(err);
  }
  return (result.stdout || "").trim();
}

function parseSecretNames(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error(`Could not find JSON array in wrangler secret list output:\n${text}`);
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  return new Set((Array.isArray(parsed) ? parsed : []).map((item) => item?.name).filter(Boolean));
}

const names = parseSecretNames(wrangler(["secret", "list", "--format", "json"]));

for (const key of KEYS) {
  if (names.has(key)) {
    console.log(`${key} already present, skip`);
    continue;
  }
  console.log(`creating encrypted secret ${key}=${SENTINEL}`);
  wrangler(["secret", "put", key], { input: SENTINEL, inherit: true });
}
