#!/usr/bin/env node
/**
 * After wrangler deploy, create Encrypted Secrets so Dashboard →
 * Variables and Secrets already lists every field name.
 * Existing secrets are never overwritten.
 *
 * Sentinel value NULL is treated as unset by envString().
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const SENTINEL = "NULL";
const SECRETS = [
  ["AUTH_MODE", "password"],
  ["BETTER_AUTH_SECRET", SENTINEL],
  ["BETTER_AUTH_URL", SENTINEL],
  ["ADMIN_USERNAME", SENTINEL],
  ["ADMIN_PASSWORD", SENTINEL],
  ["GITHUB_CLIENT_ID", SENTINEL],
  ["GITHUB_CLIENT_SECRET", SENTINEL],
  ["GOOGLE_CLIENT_ID", SENTINEL],
  ["GOOGLE_CLIENT_SECRET", SENTINEL],
  ["OAUTH_ALLOW_EMAILS", SENTINEL],
  ["CRON_SECRET", SENTINEL],
  ["CLOUDFLARE_ACCOUNT_ID", SENTINEL],
  ["CLOUDFLARE_API_TOKEN", SENTINEL],
  ["CF_WORKER_NAME", SENTINEL],
  ["CF_R2_BUCKET", SENTINEL],
  ["CF_D1_DATABASE_ID", SENTINEL],
];

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

for (const [key, value] of SECRETS) {
  if (names.has(key)) {
    console.log(`${key} already present, skip`);
    continue;
  }
  console.log(`creating encrypted secret ${key}`);
  wrangler(["secret", "put", key], { input: value, inherit: true });
}
