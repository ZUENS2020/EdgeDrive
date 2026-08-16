import { D1_BOOTSTRAP_SQL, EXPECTED_SCHEMA_VERSION } from "./d1-bootstrap-sql";

export { EXPECTED_SCHEMA_VERSION };

export const CORE_TABLES = ["files", "folders", "settings"] as const;

export const SCHEMA_VERSION_KEY = "schema_version";

let pending: Promise<void> | null = null;

export function missingCoreTables(existing: Iterable<string>): string[] {
  const have = new Set(existing);
  return CORE_TABLES.filter((name) => !have.has(name));
}

export function evaluateSchemaVersion(
  stored: string | undefined,
  expected: number = EXPECTED_SCHEMA_VERSION,
): "ok" | "untracked" | "stale" {
  if (stored == null || stored === "") return "untracked";
  const n = Number(stored);
  if (!Number.isFinite(n) || n < expected) return "stale";
  return "ok";
}

async function listUserTables(db: D1Database): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'`,
    )
    .all<{ name: string }>();
  return (rows.results || []).map((r) => r.name);
}

async function readSchemaVersion(db: D1Database): Promise<string | undefined> {
  try {
    const row = await db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .bind(SCHEMA_VERSION_KEY)
      .first<{ value: string }>();
    return row?.value?.trim();
  } catch {
    return undefined;
  }
}

async function writeSchemaVersion(db: D1Database): Promise<void> {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(SCHEMA_VERSION_KEY, String(EXPECTED_SCHEMA_VERSION))
    .run();
}

async function applyBootstrap(db: D1Database): Promise<void> {
  const existing = await listUserTables(db);
  const missing = missingCoreTables(existing);
  if (missing.length) {
    await db.exec(D1_BOOTSTRAP_SQL);
    await writeSchemaVersion(db);
    return;
  }

  const stored = await readSchemaVersion(db);
  const state = evaluateSchemaVersion(stored);
  if (state === "untracked") {
    await writeSchemaVersion(db);
    return;
  }
  if (state === "stale") {
    throw new Error(
      `D1 schema_version=${stored ?? "missing"} expected=${EXPECTED_SCHEMA_VERSION}. Redeploy so wrangler can apply migrations (npm run db:migrate / Cloudflare Git deploy).`,
    );
  }
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

export function resetD1BootstrapForTests() {
  pending = null;
}
