import { describe, expect, it } from "vitest";
import { topBars } from "./usage-charts";

describe("topBars", () => {
  it("sorts by value, drops invalid, and caps length", () => {
    expect(
      topBars(
        [
          { label: "a", value: 1 },
          { label: "b", value: 9 },
          { label: "c", value: Number.NaN },
          { label: "d", value: 3 },
        ],
        2,
      ),
    ).toEqual([
      { label: "b", value: 9 },
      { label: "d", value: 3 },
    ]);
  });
});
