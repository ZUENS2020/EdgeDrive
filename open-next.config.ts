import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Do not bind incremental cache to the user FILES bucket.
// Inner Next build must not run `npm run build` (that script is OpenNext).
export default {
  ...defineCloudflareConfig(),
  buildCommand: "node scripts/next-build.mjs",
};
