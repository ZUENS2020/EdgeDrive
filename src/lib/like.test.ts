import { describe, expect, it } from "vitest";
import { escapeLike } from "./like";

describe("escapeLike", () => {
  it("escapes backslash, percent and underscore", () => {
    expect(escapeLike("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
    expect(escapeLike("plain")).toBe("plain");
    expect(escapeLike("%_%")).toBe("\\%\\_\\%");
  });
});
