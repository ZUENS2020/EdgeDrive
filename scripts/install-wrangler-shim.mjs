#!/usr/bin/env node
/**
 * Point wrangler at scripts/wrangler-shim.mjs so Cloudflare's default
 * `npx wrangler deploy` still binds D1/R2 when missing and runs migrations.
 *
 * Only rewrite node_modules/wrangler/bin/wrangler.js. npm's
 * node_modules/.bin/wrangler is a symlink to that file.
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
const pkgBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const realBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.real.js");
const shimSrc = path.join(root, "scripts", "wrangler-shim.mjs");

if (!existsSync(pkgBin)) process.exit(0);

function restoreReal() {
  if (!existsSync(realBin)) return;
  writeFileSync(pkgBin, readFileSync(realBin));
  try {
    chmodSync(pkgBin, 0o755);
  } catch {
    // ignore
  }
}

if (!existsSync(shimSrc)) {
  restoreReal();
  process.exit(0);
}

const original = readFileSync(pkgBin, "utf8");
if (!original.includes("wrangler-shim.mjs")) {
  writeFileSync(realBin, original);
  try {
    chmodSync(realBin, 0o755);
  } catch {
    // ignore
  }
} else if (!existsSync(realBin)) {
  console.warn(
    "wrangler bin is already a shim but wrangler.real.js is missing; reinstall wrangler (`npm ci`)",
  );
  process.exit(0);
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
