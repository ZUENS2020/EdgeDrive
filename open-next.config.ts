import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Do not bind incremental cache to the user FILES bucket.
export default defineCloudflareConfig();
