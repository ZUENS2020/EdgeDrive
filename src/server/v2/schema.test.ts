import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { D1_BOOTSTRAP_SQL, EXPECTED_SCHEMA_VERSION } from "@/lib/d1-bootstrap-sql";
import { evaluateSchemaVersion } from "@/lib/d1-bootstrap";

describe("v2 fresh-deploy schema", () => {
  const migration = readFileSync(path.join(process.cwd(), "migrations-v2/0001_init.sql"), "utf8");

  it("contains the normalized catalog, blob, share and upload tables", () => {
    for (const table of ["app_settings", "folders", "blobs", "files", "shares", "share_items", "share_codes", "upload_sessions"]) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
      expect(D1_BOOTSTRAP_SQL).toContain(`CREATE TABLE ${table}`);
    }
    expect(EXPECTED_SCHEMA_VERSION).toBe(1);
  });

  it("keeps storage keys on blobs and normalized share permissions", () => {
    expect(migration).toMatch(/CREATE TABLE blobs[\s\S]*storage_key TEXT NOT NULL UNIQUE/);
    expect(migration).toMatch(/CREATE TABLE files[\s\S]*blob_id TEXT NOT NULL REFERENCES blobs/);
    expect(migration).toMatch(/CREATE TABLE share_codes[\s\S]*mode TEXT NOT NULL CHECK \(mode IN \('download', 'preview'\)\)/);
  });

  it("does not bootstrap legacy settings, tags, or analytics tables", () => {
    expect(migration).not.toMatch(/CREATE TABLE (settings|tags|file_tags|usage_samples)/);
  });

  it("fails closed when code and database schema versions differ", () => {
    expect(evaluateSchemaVersion("1", 1)).toBe("ok");
    expect(evaluateSchemaVersion("0", 1)).toBe("stale");
    expect(evaluateSchemaVersion("2", 1)).toBe("future");
  });
});
