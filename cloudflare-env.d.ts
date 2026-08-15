/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    FILES: R2Bucket;
    ASSETS?: Fetcher;
    AUTH_MODE?: string;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
  }
}

export {};
