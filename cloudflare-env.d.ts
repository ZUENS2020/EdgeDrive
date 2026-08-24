/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    FILES: R2Bucket;
    ASSETS?: Fetcher;
    CRON_SECRET?: string;
    SETUP_TOKEN?: string;
  }
}

export {};
