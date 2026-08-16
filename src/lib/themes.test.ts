import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, THEMES, getTheme, publicThemeVars, resolveThemePalette, themeCssVars } from "./themes";

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
    expect(THEMES.map((t) => t.id)).toEqual(["default", "light", "suzuka"]);
  });
});

describe("themeCssVars", () => {
  it("overrides globals.css tokens for Nocturne (not the light --text/#171717)", () => {
    const vars = themeCssVars(resolveThemePalette("suzuka"));
    expect(vars["--text"]).toBe("#E9E6E0");
    expect(vars["--text-3"]).toBe("#8B8F98");
    expect(vars["--bg"]).toBe("#08090A");
    expect(vars["--surface"]).toBe("#0E1013");
    expect(vars["--line"]).toBe("#1F2125");
    expect(vars["--brand"]).toBe("#D96C4A");
    expect(vars["--text"]).not.toBe("#171717");
    expect(vars["--foreground"]).toBe("#E9E6E0");
  });

  it("keeps Porcelain on the light globals palette", () => {
    const vars = themeCssVars(resolveThemePalette("light"));
    expect(vars["--text"]).toBe("#171717");
    expect(vars["--bg"]).toBe("#F6F5F2");
    expect(vars["--surface"]).toBe("#FFFFFF");
    expect(vars["--brand"]).toBe("#171717");
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

describe("publicThemeVars", () => {
  it("maps palette fields used by public /dl pages", () => {
    const vars = publicThemeVars("suzuka");
    expect(vars.brand).toBe("#D96C4A");
    expect(vars.bg).toBe("#08090A");
    expect(vars.surface).toBe("#0E1013");
    expect(vars.text).toBe("#E9E6E0");
    expect(vars.text3).toBe("#8B8F98");
    expect(vars.line).toBe("#1F2125");
  });
});
