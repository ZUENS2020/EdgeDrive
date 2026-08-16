import { describe, expect, it } from "vitest";
import { collectUniqueTags, parseTags, serializeTags } from "./tags";

describe("parseTags", () => {
  it("splits comma and Chinese comma, trims, de-dupes", () => {
    expect(parseTags("工作, 合同，工作, ")).toEqual(["工作", "合同"]);
    expect(parseTags("A, a, B")).toEqual(["A", "B"]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags(null)).toEqual([]);
  });

  it("caps length and count", () => {
    expect(parseTags("x".repeat(40))[0]?.length).toBe(32);
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`).join(",");
    expect(parseTags(many)).toHaveLength(20);
  });

  it("drops control characters", () => {
    expect(parseTags("ok,ba\nd")).toEqual(["ok"]);
  });
});

describe("serializeTags / collectUniqueTags", () => {
  it("round-trips a list", () => {
    expect(serializeTags(["b", "a", "b"])).toBe("b,a");
    expect(serializeTags("x, y")).toBe("x,y");
  });

  it("collects unique tags across rows", () => {
    expect(collectUniqueTags([{ tags: "b,a" }, { tags: "a,c" }, { tags: "" }])).toEqual(["a", "b", "c"]);
  });
});
