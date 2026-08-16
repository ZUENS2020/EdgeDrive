import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_ID,
  getTheme,
  parseCustomColors,
  resolveThemePalette,
  serializeCustomColors,
  STOCK_BRAND_COLOR,
} from "./themes";

describe("getTheme", () => {
  it("returns default for unknown / empty ids", () => {
    expect(getTheme("nope").id).toBe(DEFAULT_THEME_ID);
    expect(getTheme("").id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
  });

  it("returns the suzuka night-sky tokens", () => {
    const suzuka = getTheme("suzuka");
    expect(suzuka.name).toBe("铃鹿");
    expect(suzuka.palette.mode).toBe("dark");
    expect(suzuka.palette.primary.main).toBe("#D96C4A");
    expect(suzuka.palette.secondary.main).toBe("#4FA3B8");
    expect(suzuka.palette.background.default).toBe("#0B0F1C");
    expect(suzuka.palette.background.paper).toBe("#121828");
  });
});

describe("custom color overlay priority", () => {
  it("uses theme definition when brand is stock and custom is empty", () => {
    const palette = resolveThemePalette("suzuka", STOCK_BRAND_COLOR, "");
    expect(palette.primary.main).toBe("#D96C4A");
    expect(palette.background.default).toBe("#0B0F1C");
    expect(palette.text.primary).toBe("#E9E6E0");
  });

  it("lets brand_color override theme primary", () => {
    const palette = resolveThemePalette("suzuka", "#112233", "");
    expect(palette.primary.main).toBe("#112233");
    expect(palette.background.default).toBe("#0B0F1C");
  });

  it("lets custom_colors win over brand_color and theme", () => {
    const palette = resolveThemePalette(
      "suzuka",
      "#112233",
      JSON.stringify({ primary: "#00AA88", background: "#010203", text: "#EEEEEE" }),
    );
    expect(palette.primary.main).toBe("#00AA88");
    expect(palette.background.default).toBe("#010203");
    expect(palette.text.primary).toBe("#EEEEEE");
  });

  it("clears custom colors back to the theme", () => {
    const overlay = resolveThemePalette("light", "#112233", '{"primary":"#ABCDEF"}');
    expect(overlay.primary.main).toBe("#ABCDEF");
    const restored = resolveThemePalette("light", STOCK_BRAND_COLOR, "");
    expect(restored.primary.main).toBe(getTheme("light").palette.primary.main);
    expect(restored.background.default).toBe(getTheme("light").palette.background.default);
  });

  it("ignores invalid custom_colors JSON", () => {
    const palette = resolveThemePalette("default", "#445566", "{not json");
    expect(palette.primary.main).toBe("#445566");
  });
});

describe("parseCustomColors", () => {
  it("round-trips hex fields and drops junk", () => {
    expect(parseCustomColors("")).toEqual({});
    expect(parseCustomColors('{"primary":"#ABCDEF","nope":1}')).toEqual({ primary: "#ABCDEF" });
    expect(serializeCustomColors({ primary: "#ABCDEF", background: "red" })).toBe('{"primary":"#ABCDEF"}');
  });
});
