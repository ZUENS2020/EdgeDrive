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
    CRON_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    OAUTH_ALLOW_EMAILS?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
    /** Optional analytics filters (Dashboard vars). Not used for D1/R2 bindings. */
    CF_WORKER_NAME?: string;
    CF_R2_BUCKET?: string;
    CF_D1_DATABASE_ID?: string;
  }
}

export {};
