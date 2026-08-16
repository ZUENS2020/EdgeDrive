import { describe, expect, it } from "vitest";
import { parseInstantCheckBody } from "./instant";

describe("parseInstantCheckBody", () => {
  it("accepts a sanitized name/path + sha256", () => {
    expect(
      parseInstantCheckBody({
        sha256: "A".repeat(64),
        name: "photo.png",
        path: "albums",
      }),
    ).toEqual({
      sha256: "a".repeat(64),
      name: "photo.png",
      path: "albums",
    });
  });

  it("rejects bad hash, empty name, and traversal", () => {
    expect(parseInstantCheckBody(null)).toEqual({ error: "invalid json" });
    expect(parseInstantCheckBody({ sha256: "nope", name: "a.txt" })).toEqual({ error: "bad-sha256" });
    expect(parseInstantCheckBody({ sha256: "a".repeat(64), name: "" })).toEqual({ error: "empty" });
    expect(parseInstantCheckBody({ sha256: "a".repeat(64), name: "../x.txt" })).toEqual({
      error: "invalid-name",
    });
  });
});
