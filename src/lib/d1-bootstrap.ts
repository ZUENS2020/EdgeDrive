import { D1_BOOTSTRAP_SQL } from "./d1-bootstrap-sql";

let pending: Promise<void> | null = null;

async function schemaReady(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'files'")
    .first<{ ok: number }>();
  return Boolean(row);
}

async function applyBootstrap(db: D1Database): Promise<void> {
  if (await schemaReady(db)) return;
  await db.exec(D1_BOOTSTRAP_SQL);
}

/** First request after a Git deploy may hit an empty auto-provisioned D1. */
export function ensureD1Schema(db: D1Database): Promise<void> {
  if (!pending) {
    pending = applyBootstrap(db).catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}
