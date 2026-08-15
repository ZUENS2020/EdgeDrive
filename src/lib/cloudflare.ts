import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AuthMode } from "./types";

export async function getCfEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export async function getDB(): Promise<D1Database> {
  const env = await getCfEnv();
  if (!env.DB) {
    throw new Error("D1 binding DB is missing. Check wrangler.jsonc.");
  }
  return env.DB;
}

export async function getR2(): Promise<R2Bucket> {
  const env = await getCfEnv();
  if (!env.FILES) {
    throw new Error("R2 binding FILES is missing. Check wrangler.jsonc.");
  }
  return env.FILES;
}

export function readAuthMode(env?: CloudflareEnv): AuthMode {
  const raw = (process.env.AUTH_MODE || env?.AUTH_MODE || "password")
    .trim()
    .toLowerCase();
  if (raw === "none" || raw === "access") return "access";
  if (raw === "oauth") return "oauth";
  return "password";
}

export function isAccessMode(mode: AuthMode): boolean {
  return mode === "access";
}

export function listOAuthProviders(env?: CloudflareEnv): Array<"github" | "google"> {
  const out: Array<"github" | "google"> = [];
  if (envString(env, "GITHUB_CLIENT_ID") && envString(env, "GITHUB_CLIENT_SECRET")) out.push("github");
  if (envString(env, "GOOGLE_CLIENT_ID") && envString(env, "GOOGLE_CLIENT_SECRET")) out.push("google");
  return out;
}

export async function getAuthMode(): Promise<AuthMode> {
  try {
    const env = await getCfEnv();
    return readAuthMode(env);
  } catch {
    return readAuthMode();
  }
}

export function envString(
  env: CloudflareEnv | undefined,
  key: keyof CloudflareEnv,
): string | undefined {
  const fromBinding = env?.[key];
  if (typeof fromBinding === "string" && fromBinding) return fromBinding;
  const fromProcess = process.env[key];
  return fromProcess || undefined;
}
