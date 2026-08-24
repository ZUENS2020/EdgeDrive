import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

describe("v2 cursor", () => {
  it("round-trips the stable created-at and id tuple", () => {
    const value = { createdAt: "2026-08-24T08:00:00.000Z", id: "9af0c5d8-361e-48c8-9a9e-e78b8bf8e4ae" };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it("fails closed for malformed cursor input", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({ createdAt: "", id: "x" })))).toBeNull();
  });
});
