#!/usr/bin/env node
/**
 * Point wrangler at scripts/wrangler-shim.mjs so Cloudflare's default
 * `npx wrangler deploy` still binds D1/R2 when missing and runs migrations.
 *
 * This rewrites node_modules/wrangler/bin/wrangler.js. That is brittle:
 * if wrangler moves its CLI entry, this script MUST fail loudly.
 * Prefer `npm run deploy` (scripts/cf-deploy.mjs) when you control the
 * deploy command.
 */
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(root, "node_modules", "wrangler");
const pkgBin = path.join(pkgDir, "bin", "wrangler.js");
const realBin = path.join(pkgDir, "bin", "wrangler.real.js");
const shimSrc = path.join(root, "scripts", "wrangler-shim.mjs");
const pkgJson = path.join(pkgDir, "package.json");

function fail(message) {
  console.error(`[edgedrive] wrangler shim: ${message}`);
  console.error("[edgedrive] Do not ignore this. Use `npm run deploy`, or reinstall wrangler (`npm ci`).");
  process.exit(1);
}

if (!existsSync(shimSrc)) {
  fail("scripts/wrangler-shim.mjs is missing");
}

if (!existsSync(pkgDir) || !existsSync(pkgJson)) {
  fail("node_modules/wrangler is missing (expected wrangler as a dependency)");
}

if (!existsSync(pkgBin)) {
  fail(
    "node_modules/wrangler/bin/wrangler.js not found — wrangler package layout changed. Update scripts/install-wrangler-shim.mjs or deploy with `npm run deploy`.",
  );
}

const original = readFileSync(pkgBin, "utf8");
const looksLikeWranglerCli =
  original.includes("wrangler-shim.mjs") ||
  /wrangler/i.test(original) ||
  existsSync(path.join(pkgDir, "wrangler-dist")) ||
  existsSync(path.join(pkgDir, "bin"));

if (!looksLikeWranglerCli) {
  fail("wrangler/bin/wrangler.js does not look like the wrangler CLI (package layout changed)");
}

if (!original.includes("wrangler-shim.mjs")) {
  if (original.length < 40) {
    fail("wrangler/bin/wrangler.js is unexpectedly small; refusing to wrap it");
  }
  writeFileSync(realBin, original);
  try {
    chmodSync(realBin, 0o755);
  } catch {
    // ignore
  }
} else if (!existsSync(realBin)) {
  fail("wrangler bin is already a shim but wrangler.real.js is missing; reinstall wrangler (`npm ci`)");
}

const launcher = `#!/usr/bin/env node
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function findShim(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "scripts", "wrangler-shim.mjs");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("scripts/wrangler-shim.mjs not found from " + start);
}

const shim = findShim(__dirname);
const child = spawn(process.execPath, [shim, ...process.argv.slice(2)], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
`;
writeFileSync(pkgBin, launcher);
try {
  chmodSync(pkgBin, 0o755);
} catch {
  // ignore
}

const binDir = path.join(root, "node_modules", ".bin");
mkdirSync(binDir, { recursive: true });
const binPath = path.join(binDir, "wrangler");
const binTarget = "../wrangler/bin/wrangler.js";
try {
  if (!lstatSync(binPath).isSymbolicLink()) {
    unlinkSync(binPath);
    symlinkSync(binTarget, binPath);
  }
} catch {
  try {
    symlinkSync(binTarget, binPath);
  } catch {
    // ignore
  }
}
