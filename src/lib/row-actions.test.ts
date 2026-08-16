import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROW_ACTIONS,
  ROW_ACTION_IDS,
  parseRowActions,
  serializeRowActions,
  setRowActionEnabled,
} from "./row-actions";

describe("parseRowActions", () => {
  it("defaults when missing, empty string, or invalid JSON", () => {
    expect(parseRowActions(undefined)).toEqual(DEFAULT_ROW_ACTIONS);
    expect(parseRowActions(null)).toEqual(DEFAULT_ROW_ACTIONS);
    expect(parseRowActions("")).toEqual(DEFAULT_ROW_ACTIONS);
    expect(parseRowActions("not-json")).toEqual(DEFAULT_ROW_ACTIONS);
    expect(parseRowActions("{}")).toEqual(DEFAULT_ROW_ACTIONS);
    expect(parseRowActions(1)).toEqual(DEFAULT_ROW_ACTIONS);
  });

  it("keeps an explicit empty list (inline only shows more)", () => {
    expect(parseRowActions([])).toEqual([]);
    expect(parseRowActions("[]")).toEqual([]);
  });

  it("parses the migration default JSON", () => {
    expect(DEFAULT_ROW_ACTIONS).toEqual([
      "download",
      "preview",
      "copy_link",
      "copy_view_link",
      "expire",
      "delete",
    ]);
    expect(serializeRowActions(DEFAULT_ROW_ACTIONS)).toBe(
      '["download","preview","copy_link","copy_view_link","expire","delete"]',
    );
    expect(parseRowActions('["download","preview","copy_link","copy_view_link","expire","delete"]')).toEqual(
      DEFAULT_ROW_ACTIONS,
    );
    expect(serializeRowActions([])).toBe("[]");
  });

  it("filters unknown ids, trims, and de-dupes while keeping order", () => {
    expect(parseRowActions(["preview", "nope", "preview", " star ", "download"])).toEqual([
      "preview",
      "star",
      "download",
    ]);
    expect(parseRowActions('["copy_to","delete","delete"]')).toEqual(["copy_to", "delete"]);
  });

  it("falls back to default when a non-empty list has no valid ids", () => {
    expect(parseRowActions(["nope", 1, null])).toEqual(DEFAULT_ROW_ACTIONS);
    expect(parseRowActions('["bogus"]')).toEqual(DEFAULT_ROW_ACTIONS);
  });
});

describe("setRowActionEnabled", () => {
  it("adds and removes in catalog order", () => {
    const next = setRowActionEnabled(DEFAULT_ROW_ACTIONS, "star", true);
    expect(next).toEqual([
      "download",
      "preview",
      "copy_link",
      "copy_view_link",
      "expire",
      "star",
      "delete",
    ]);
    expect(setRowActionEnabled(next, "download", false)).toEqual([
      "preview",
      "copy_link",
      "copy_view_link",
      "expire",
      "star",
      "delete",
    ]);
  });

  it("can uncheck everything", () => {
    let current: string[] = [...DEFAULT_ROW_ACTIONS];
    for (const id of [...current]) {
      current = setRowActionEnabled(current, id as (typeof ROW_ACTION_IDS)[number], false);
    }
    expect(current).toEqual([]);
    expect(setRowActionEnabled([], "preview", true)).toEqual(["preview"]);
  });
});
