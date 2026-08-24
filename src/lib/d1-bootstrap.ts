import { D1_BOOTSTRAP_SQL, EXPECTED_SCHEMA_VERSION } from "./d1-bootstrap-sql";

export { EXPECTED_SCHEMA_VERSION };

export const CORE_TABLES = ["app_settings", "folders", "blobs", "files", "shares", "share_items", "share_codes", "upload_sessions"] as const;

let pending: Promise<void> | null = null;

export function missingCoreTables(existing: Iterable<string>): string[] {
  const have = new Set(existing);
  return CORE_TABLES.filter((name) => !have.has(name));
}

export function evaluateSchemaVersion(
  stored: string | undefined,
  expected: number = EXPECTED_SCHEMA_VERSION,
): "ok" | "untracked" | "stale" | "future" {
  if (stored == null || stored === "") return "untracked";
  const n = Number(stored);
  if (!Number.isFinite(n) || n < expected) return "stale";
  if (n > expected) return "future";
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
      .prepare("SELECT schema_version FROM app_settings WHERE id = 1")
      .first<{ schema_version: number }>();
    return row?.schema_version == null ? undefined : String(row.schema_version);
  } catch {
    return undefined;
  }
}

async function applyBootstrap(db: D1Database): Promise<void> {
  const existing = await listUserTables(db);
  const missing = missingCoreTables(existing);
  if (existing.length === 0) {
    await db.exec(D1_BOOTSTRAP_SQL);
    return;
  }

  if (missing.length) {
    const legacy = existing.includes("settings") && !existing.includes("app_settings");
    throw new Error(
      legacy
        ? "EdgeDrive v2 requires a fresh D1 database; the bound database uses the legacy schema."
        : `EdgeDrive v2 schema is incomplete; missing tables: ${missing.join(", ")}.`,
    );
  }

  const stored = await readSchemaVersion(db);
  const state = evaluateSchemaVersion(stored);
  if (state !== "ok") {
    throw new Error(
      `D1 schema_version=${stored ?? "missing"} expected=${EXPECTED_SCHEMA_VERSION}. Bind a fresh v2 database or redeploy so migrations can run.`,
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
