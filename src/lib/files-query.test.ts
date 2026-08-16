import { describe, expect, it } from "vitest";
import {
  buildFileListWhere,
  isoDaysAgo,
  parseFileListFilter,
  TRASH_RETENTION_DAYS,
  trashCutoffIso,
} from "./files-query";

describe("parseFileListFilter", () => {
  it("accepts known filters and falls back to all", () => {
    expect(parseFileListFilter("trash")).toBe("trash");
    expect(parseFileListFilter("starred")).toBe("starred");
    expect(parseFileListFilter("recent")).toBe("recent");
    expect(parseFileListFilter("nope")).toBe("all");
    expect(parseFileListFilter(undefined)).toBe("all");
  });
});

describe("buildFileListWhere", () => {
  const nowIso = "2026-08-16T00:00:00.000Z";
  const soonIso = "2026-08-17T00:00:00.000Z";

  it("excludes trash by default and scopes path", () => {
    const q = buildFileListWhere({ path: "docs", nowIso, soonIso });
    expect(q.clause).toContain("deleted_at IS NULL");
    expect(q.clause).toContain("path = ?");
    expect(q.binds).toEqual(["docs"]);
  });

  it("lists trash globally without path", () => {
    const q = buildFileListWhere({ path: "docs", filter: "trash", nowIso, soonIso });
    expect(q.clause).toContain("deleted_at IS NOT NULL");
    expect(q.clause).not.toContain("path = ?");
    expect(q.binds).toEqual([]);
  });

  it("filters starred and recent without folder path", () => {
    const starred = buildFileListWhere({ path: "docs", filter: "starred", nowIso, soonIso });
    expect(starred.clause).toContain("starred != 0");
    expect(starred.clause).not.toContain("path = ?");
    const recent = buildFileListWhere({ path: "docs", filter: "recent", nowIso, soonIso });
    expect(recent.clause).toContain("deleted_at IS NULL");
    expect(recent.clause).not.toContain("path = ?");
  });

  it("applies tag LIKE and search", () => {
    const q = buildFileListWhere({ q: "report", tag: "合同", nowIso, soonIso });
    expect(q.clause).toContain("name LIKE ?");
    expect(q.clause).toContain("tags");
    expect(q.binds[0]).toBe("%report%");
    expect(q.binds[1]).toBe("%,合同,%");
  });

  it("keeps expiry filters on live files", () => {
    const expired = buildFileListWhere({ filter: "expired", nowIso, soonIso });
    expect(expired.clause).toContain("expires < ?");
    expect(expired.binds).toEqual([nowIso]);
  });
});

describe("trash cutoff", () => {
  it("is 30 days before now", () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
    const now = Date.parse("2026-08-16T00:00:00.000Z");
    expect(trashCutoffIso(now)).toBe(isoDaysAgo(30, now));
    expect(trashCutoffIso(now)).toBe("2026-07-17T00:00:00.000Z");
  });
});
