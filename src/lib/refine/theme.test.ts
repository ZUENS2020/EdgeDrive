import { describe, expect, it } from "vitest";
import { createAdminTheme } from "./theme";

describe("createAdminTheme", () => {
  it("uses light action/icon colors on Nocturne (not Refine light black)", () => {
    const theme = createAdminTheme({ theme_name: "suzuka" });
    expect(theme.palette.mode).toBe("dark");
    expect(theme.palette.text.primary).toBe("#E9E6E0");
    expect(theme.palette.action.active.toLowerCase()).toMatch(/#fff|#ffffff|255/);
    expect(theme.components?.MuiListItemIcon?.styleOverrides).toBeTruthy();
  });

  it("keeps dark action colors on Porcelain", () => {
    const theme = createAdminTheme({ theme_name: "light" });
    expect(theme.palette.mode).toBe("light");
    expect(theme.palette.text.primary).toBe("#171717");
    expect(theme.palette.action.active.toLowerCase()).toMatch(/#000|#000000|rgba\(0,/);
  });
});
