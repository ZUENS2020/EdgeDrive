import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readAccessEnabledFromDb } from "./app-config";
import { ensureD1Schema } from "./d1-bootstrap";

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

export async function isAccessEnabled(): Promise<boolean> {
  try {
    const db = await getDB();
    return await readAccessEnabledFromDb(db);
  } catch {
    return false;
  }
}

/** Optional one-time setup token. Unset = first boot is open. */
export async function getSetupToken(): Promise<string | undefined> {
  const env = await getCfEnv().catch(() => null);
  const raw = String((env as { SETUP_TOKEN?: string } | null)?.SETUP_TOKEN || "").trim();
  if (!raw || raw.toUpperCase() === "NULL") return undefined;
  return raw;
}
