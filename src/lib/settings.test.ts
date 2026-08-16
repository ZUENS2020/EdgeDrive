import { describe, expect, it } from "vitest";
import { enableAccess, getSettings, updateSettings } from "./settings";

type Row = { key: string; value: string };

function memoryD1(initial: Row[] = []): D1Database {
  const map = new Map(initial.map((r) => [r.key, r.value]));
  const api = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("SELECT value FROM settings")) {
                const value = map.get(String(args[0]));
                return (value == null ? null : ({ value } as T));
              }
              return null;
            },
            async all<T>() {
              return { results: [...map.entries()].map(([key, value]) => ({ key, value })) as T[] };
            },
            async run() {
              if (sql.startsWith("INSERT INTO settings")) {
                map.set(String(args[0]), String(args[1]));
              } else if (sql.startsWith("DELETE FROM settings")) {
                map.delete(String(args[0]));
              }
              return { success: true };
            },
          };
        },
        async all<T>() {
          return { results: [...map.entries()].map(([key, value]) => ({ key, value })) as T[] };
        },
        async first() {
          return null;
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
  return api as unknown as D1Database;
}

describe("access settings in D1", () => {
  it("reads cf_access_team / cf_access_aud from settings KV", async () => {
    const db = memoryD1([
      { key: "cf_access_team", value: "zuens2020" },
      { key: "cf_access_aud", value: "aud-1" },
    ]);
    const settings = await getSettings(db);
    expect(settings.cf_access_team).toBe("zuens2020");
    expect(settings.cf_access_aud).toBe("aud-1");
    expect(settings.access_enabled).toBe(false);
  });

  it("persists team/aud on save without enabling Access", async () => {
    const db = memoryD1();
    const next = await updateSettings({ cf_access_team: " zuens2020 ", cf_access_aud: "aud-1" }, db);
    expect(next.cf_access_team).toBe("zuens2020");
    expect(next.cf_access_aud).toBe("aud-1");
    expect(next.access_enabled).toBe(false);
    const again = await getSettings(db);
    expect(again.cf_access_team).toBe("zuens2020");
    expect(again.cf_access_aud).toBe("aud-1");
  });

  it("enableAccess rejects missing team/aud", async () => {
    const db = memoryD1();
    await expect(enableAccess("", "aud-1", db)).rejects.toThrow(/access-needs-team-aud/);
    await expect(enableAccess("team", "", db)).rejects.toThrow(/access-needs-team-aud/);
  });

  it("enableAccess writes team/aud and flips access_enabled", async () => {
    const db = memoryD1();
    const next = await enableAccess(" zuens2020 ", "aud-1", db);
    expect(next.access_enabled).toBe(true);
    expect(next.cf_access_team).toBe("zuens2020");
    expect(next.cf_access_aud).toBe("aud-1");
  });

  it("enableAccess cannot run twice", async () => {
    const db = memoryD1();
    await enableAccess("zuens2020", "aud-1", db);
    await expect(enableAccess("zuens2020", "aud-1", db)).rejects.toThrow(/access-already-enabled/);
  });

  it("updateSettings cannot turn access_enabled off", async () => {
    const db = memoryD1([{ key: "access_enabled", value: "1" }]);
    const next = await updateSettings({ page_size: 25 }, db);
    expect(next.access_enabled).toBe(true);
    expect(next.page_size).toBe(25);
  });

  it("persists theme_name", async () => {
    const db = memoryD1();
    const next = await updateSettings({ theme_name: "suzuka" }, db);
    expect(next.theme_name).toBe("suzuka");
    const again = await getSettings(db);
    expect(again.theme_name).toBe("suzuka");
  });

  it("unknown theme_name falls back to default", async () => {
    const db = memoryD1();
    const next = await updateSettings({ theme_name: "not-a-theme" }, db);
    expect(next.theme_name).toBe("default");
  });

  it("defaults row_actions when unset", async () => {
    const settings = await getSettings(memoryD1());
    expect(settings.row_actions).toEqual([
      "download",
      "preview",
      "copy_link",
      "copy_view_link",
      "expire",
      "delete",
    ]);
  });

  it("parses and persists row_actions JSON", async () => {
    const db = memoryD1([{ key: "row_actions", value: '["preview","star"]' }]);
    const settings = await getSettings(db);
    expect(settings.row_actions).toEqual(["preview", "star"]);
    const next = await updateSettings({ row_actions: ["download", "delete"] }, db);
    expect(next.row_actions).toEqual(["download", "delete"]);
    const again = await getSettings(db);
    expect(again.row_actions).toEqual(["download", "delete"]);
    const fromString = await updateSettings({ row_actions: '["star","tags"]' }, db);
    expect(fromString.row_actions).toEqual(["star", "tags"]);
  });

  it("persists an empty row_actions list", async () => {
    const db = memoryD1();
    const next = await updateSettings({ row_actions: [] }, db);
    expect(next.row_actions).toEqual([]);
    expect((await getSettings(db)).row_actions).toEqual([]);
  });

  it("falls back to default for invalid stored row_actions", async () => {
    const db = memoryD1([{ key: "row_actions", value: "not-json" }]);
    const settings = await getSettings(db);
    expect(settings.row_actions[0]).toBe("download");
    expect(settings.row_actions).toContain("delete");
  });
});
