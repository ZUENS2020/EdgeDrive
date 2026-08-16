import { describe, expect, it } from "vitest";
import { getSettings, updateSettings } from "./settings";

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
  });

  it("persists team/aud on save", async () => {
    const db = memoryD1();
    const next = await updateSettings({ cf_access_team: " zuens2020 ", cf_access_aud: "aud-1" }, db);
    expect(next.cf_access_team).toBe("zuens2020");
    expect(next.cf_access_aud).toBe("aud-1");
    const again = await getSettings(db);
    expect(again.cf_access_team).toBe("zuens2020");
    expect(again.cf_access_aud).toBe("aud-1");
  });

  it("rejects switching to access without team/aud", async () => {
    const db = memoryD1();
    await expect(updateSettings({ auth_mode: "access" }, db)).rejects.toThrow(/access-mode-needs-env/);
  });

  it("allows switching to access when team/aud are in the same patch", async () => {
    const db = memoryD1();
    const next = await updateSettings(
      { auth_mode: "access", cf_access_team: "zuens2020", cf_access_aud: "aud-1" },
      db,
    );
    expect(next.auth_mode).toBe("access");
  });
});
