import { describe, expect, it } from "vitest";
import {
  copyErrorMessage,
  copyResponseStatus,
  decideCopyItem,
  parseCopyBody,
  withCopyMessages,
} from "./copy";

describe("parseCopyBody", () => {
  it("accepts ids + root or nested target_path", () => {
    expect(parseCopyBody({ ids: ["a", "a", "b"], target_path: "" })).toEqual({
      ids: ["a", "b"],
      target_path: "",
    });
    expect(parseCopyBody({ ids: ["a"], target_path: "docs/work" })).toEqual({
      ids: ["a"],
      target_path: "docs/work",
    });
  });

  it("rejects empty ids, missing target, and traversal", () => {
    expect(parseCopyBody(null)).toEqual({ error: "invalid json" });
    expect(parseCopyBody({ target_path: "" })).toEqual({ error: "need ids" });
    expect(parseCopyBody({ ids: [], target_path: "" })).toEqual({ error: "need ids" });
    expect(parseCopyBody({ ids: ["a"] })).toEqual({ error: "need target_path" });
    expect(parseCopyBody({ ids: ["a"], target_path: "../x" })).toEqual({ error: "path-traversal" });
  });
});

describe("decideCopyItem", () => {
  it("rejects missing, deleted, same folder, then same-name", () => {
    expect(decideCopyItem(null, "docs", false)).toBe("not-found");
    expect(decideCopyItem({ path: "docs", deleted_at: "2026-08-01T00:00:00.000Z" }, "inbox", false)).toBe(
      "not-found",
    );
    expect(decideCopyItem({ path: "docs", deleted_at: null }, "docs", true)).toBe("same-path");
    expect(decideCopyItem({ path: "", deleted_at: null }, "docs", true)).toBe("file-exists");
    expect(decideCopyItem({ path: "", deleted_at: null }, "docs", false)).toBe("copy");
  });
});

describe("copyResponseStatus", () => {
  it("is 200 when any item copied, 409 when all are name clashes", () => {
    expect(
      copyResponseStatus(2, [
        { id: "1", ok: true },
        { id: "2", ok: false, error: "file-exists" },
      ]),
    ).toBe(200);
    expect(copyResponseStatus(0, [{ id: "1", ok: false, error: "file-exists" }])).toBe(409);
    expect(copyResponseStatus(0, [{ id: "1", ok: false, error: "same-path" }])).toBe(400);
  });
});

describe("copy messages", () => {
  it("maps file-exists to the Chinese 409 hint", () => {
    expect(copyErrorMessage("file-exists")).toBe("目标文件夹已有同名文件");
    expect(copyErrorMessage("file-exists", "en")).toMatch(/already exists/i);
    expect(withCopyMessages([{ id: "1", ok: false, error: "file-exists" }])).toEqual([
      { id: "1", ok: false, error: "file-exists", message: "目标文件夹已有同名文件" },
    ]);
  });
});
