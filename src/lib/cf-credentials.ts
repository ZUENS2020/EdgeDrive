import { getKv, KV } from "./app-config";

export function readEnvSecret(name: string, env?: Record<string, unknown>): string | undefined {
  const fromProcess = String(process.env[name] || "").trim();
  const fromEnv = env ? String(env[name] ?? "").trim() : "";
  const raw = fromProcess || fromEnv;
  if (!raw || raw.toUpperCase() === "NULL") return undefined;
  return raw;
}

/** Worker Secret `CF_API_TOKEN` 优先；未配则回退 D1 settings。 */
export async function resolveCfApiToken(
  db: D1Database,
  env?: Record<string, unknown>,
): Promise<string | undefined> {
  return readEnvSecret("CF_API_TOKEN", env) || (await getKv(db, KV.cfApiToken));
}

export function cfApiTokenConfigured(d1Value: string | undefined, env?: Record<string, unknown>): boolean {
  return Boolean(readEnvSecret("CF_API_TOKEN", env) || d1Value);
}
