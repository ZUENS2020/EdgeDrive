import { getCloudflareContext } from "@opennextjs/cloudflare";
import { parseAuthMode, readAuthModeFromDb } from "./app-config";
import { ensureD1Schema } from "./d1-bootstrap";
import { isAccessMode, type AuthMode } from "./types";

export { isAccessMode };

export async function getCfEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export async function getDB(): Promise<D1Database> {
  const env = await getCfEnv();
  if (!env.DB) {
    throw new Error(
      "D1 binding DB is missing. First deploy should auto-create it; or add a D1 database named DB in Worker → Settings → Bindings.",
    );
  }
  await ensureD1Schema(env.DB);
  return env.DB;
}

export async function getR2(): Promise<R2Bucket> {
  const env = await getCfEnv();
  if (!env.FILES) {
    throw new Error(
      "R2 binding FILES is missing. First deploy should auto-create it; or add an R2 bucket named FILES in Worker → Settings → Bindings.",
    );
  }
  return env.FILES;
}

export async function getAuthMode(): Promise<AuthMode> {
  try {
    const db = await getDB();
    return await readAuthModeFromDb(db);
  } catch {
    return parseAuthMode("password");
  }
}
