#!/usr/bin/env node
/**
 * After wrangler deploy, create Encrypted Secrets so Dashboard →
 * Variables and Secrets already lists every field name.
 * Existing secrets are never overwritten.
 *
 * Sentinel value NULL is treated as unset by envString().
 * Do not copy process.env.CLOUDFLARE_API_TOKEN into the Worker —
 * that value is the deploy CLI credential, not a runtime secret.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SENTINEL = "NULL";
const DEFAULT_NAME = "edgedrive";
const SECRETS = [
  ["AUTH_MODE", "password"],
  ["BETTER_AUTH_SECRET", SENTINEL],
  ["BETTER_AUTH_URL", SENTINEL],
  ["ADMIN_USERNAME", SENTINEL],
  ["ADMIN_PASSWORD", SENTINEL],
  ["CRON_SECRET", SENTINEL],
  ["CLOUDFLARE_ACCOUNT_ID", SENTINEL],
  ["CLOUDFLARE_API_TOKEN", SENTINEL],
  ["CF_WORKER_NAME", SENTINEL],
  ["CF_R2_BUCKET", SENTINEL],
  ["CF_D1_DATABASE_ID", SENTINEL],
];

const wranglerBin = path.join(process.cwd(), "node_modules", ".bin", "wrangler");

function loadName() {
  const cfgPath =
    process.env.CF_WRANGLER_CONFIG ||
    ["wrangler.jsonc", "wrangler.json"].find((p) => existsSync(p));
  if (!cfgPath || !existsSync(cfgPath)) return DEFAULT_NAME;
  const text = readFileSync(cfgPath, "utf8").replace(/^\uFEFF/, "");
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  try {
    const parsed = JSON.parse(stripped);
    return typeof parsed?.name === "string" && parsed.name.trim()
      ? parsed.name.trim()
      : DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

function wrangler(args, { input, inherit } = {}) {
  const result = spawnSync(wranglerBin, args, {
    encoding: "utf8",
    input,
    stdio: inherit ? ["pipe", "inherit", "inherit"] : ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim() || `wrangler ${args.join(" ")} failed`;
    throw new Error(err);
  }
  return `${result.stdout || ""}\n${result.stderr || ""}`.trim();
}

function parseSecretNames(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error("wrangler secret list returned empty output");
  }
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error(`Could not find JSON array in wrangler secret list output:\n${text}`);
  }
  const parsed = JSON.parse(trimmed.slice(start, end + 1));
  return new Set((Array.isArray(parsed) ? parsed : []).map((item) => item?.name).filter(Boolean));
}

const workerName = loadName();
const names = parseSecretNames(wrangler(["secret", "list", "--format", "json", "--name", workerName]));

for (const [key, value] of SECRETS) {
  if (names.has(key)) {
    console.log(`${key} already present, skip`);
    continue;
  }
  console.log(`creating encrypted secret ${key}`);
  wrangler(["secret", "put", key, "--name", workerName], { input: value, inherit: true });
}
