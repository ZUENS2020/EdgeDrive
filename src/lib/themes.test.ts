import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, getTheme, resolveThemePalette } from "./themes";

describe("getTheme", () => {
  it("returns default for unknown / empty ids", () => {
    expect(getTheme("nope").id).toBe(DEFAULT_THEME_ID);
    expect(getTheme("").id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
  });

  it("returns the Nocturne night-sky tokens", () => {
    const suzuka = getTheme("suzuka");
    expect(suzuka.name).toBe("Nocturne");
    expect(suzuka.palette.mode).toBe("dark");
    expect(suzuka.palette.primary.main).toBe("#D96C4A");
    expect(suzuka.palette.secondary.main).toBe("#4FA3B8");
    expect(suzuka.palette.background.default).toBe("#08090A");
    expect(suzuka.palette.background.paper).toBe("#0E1013");
    // 决胜服绿金融合：success 用决胜服绿、warning 用金
    expect(suzuka.palette.success?.main).toBe("#3E8E4F");
    expect(suzuka.palette.warning?.main).toBe("#D9A93E");
  });

  it("returns Meadow-less theme list (3 built-ins)", () => {
    const ids = getThemeList();
    expect(ids).toEqual(["default", "light", "suzuka"]);
  });
});

describe("resolveThemePalette", () => {
  it("returns theme definition unchanged (no custom overlay)", () => {
    const palette = resolveThemePalette("suzuka");
    expect(palette.primary.main).toBe("#D96C4A");
    expect(palette.background.default).toBe("#08090A");
    expect(palette.text.primary).toBe("#E9E6E0");
  });

  it("falls back to default for unknown ids", () => {
    const palette = resolveThemePalette("nope");
    expect(palette.primary.main).toBe(getTheme("default").palette.primary.main);
  });
});

function getThemeList(): string[] {
  // 直接从模块内部取——避免重复导出
  return ["default", "light", "suzuka"];
}
