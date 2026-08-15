import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(root, "node_modules", "wrangler");
const pkgBin = path.join(pkgDir, "bin", "wrangler.js");
const realBin = path.join(pkgDir, "bin", "wrangler.real.js");

function isShim(file) {
  try {
    return readFileSync(file, "utf8").includes("wrangler-shim.mjs");
  } catch {
    return false;
  }
}

/** Absolute path to the original wrangler CLI (not the project shim). */
export const wranglerJs = (() => {
  if (existsSync(realBin) && !isShim(realBin)) return realBin;
  if (existsSync(pkgBin) && !isShim(pkgBin)) return pkgBin;
  throw new Error(
    "Could not find the real wrangler CLI. Reinstall dependencies (`npm ci`) so postinstall can wrap wrangler.",
  );
})();
