export const DEFAULT_THEME_ID = "default";
export const STOCK_BRAND_COLOR = "#171717";
export const HEX6 = /^#[0-9a-fA-F]{6}$/;

export type CustomColors = {
  primary?: string;
  background?: string;
  text?: string;
};

export type Appearance = {
  theme_name: string;
  brand_color: string;
  custom_colors: string;
};

export type ThemeDefinition = {
  id: string;
  name: string;
  description: string;
  palette: {
    mode: "light" | "dark";
    primary: { main: string; light?: string; dark?: string; contrastText?: string };
    secondary: { main: string };
    background: { default: string; paper: string };
    text: { primary: string; secondary: string };
    divider: string;
    success?: { main: string };
    error?: { main: string };
    warning?: { main: string };
    info?: { main: string };
    sidebarBg?: string;
    sidebarText?: string;
    sidebarActiveBg?: string;
    cardBg?: string;
    hoverBg?: string;
    codeBg?: string;
    brandBar?: string;
  };
};

export type ThemePalette = ThemeDefinition["palette"];

export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX6.test(value);
}

export function hexContrast(hex: string): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.42 ? "#171717" : "#FAFAFA";
}

const DEFAULT_THEME: ThemeDefinition = {
  id: "default",
  name: "Default",
  description: "EdgeDrive 暗色：近黑底、#171717 品牌条，从现有 Linear 配色提取。",
  palette: {
    mode: "dark",
    primary: { main: "#EDEDED", light: "#FFFFFF", dark: "#D4D4D4", contrastText: "#171717" },
    secondary: { main: "#8A8F98" },
    background: { default: "#08090A", paper: "#191A1B" },
    text: { primary: "#F7F8F8", secondary: "#8A8F98" },
    divider: "rgba(255,255,255,0.08)",
    success: { main: "#10B981" },
    error: { main: "#EB5757" },
    warning: { main: "#E2A336" },
    info: { main: "#8A8F98" },
    sidebarBg: "#0F1011",
    sidebarText: "#F7F8F8",
    sidebarActiveBg: "rgba(255,255,255,0.06)",
    cardBg: "#191A1B",
    hoverBg: "#28282C",
    codeBg: "#121314",
    brandBar: "#171717",
  },
};

const LIGHT_THEME: ThemeDefinition = {
  id: "light",
  name: "Light",
  description: "亮色主题：白底黑字，主色沿用标记色风格。",
  palette: {
    mode: "light",
    primary: { main: "#171717", light: "#404040", dark: "#0A0A0A", contrastText: "#FAFAFA" },
    secondary: { main: "#525252" },
    background: { default: "#F6F5F2", paper: "#FFFFFF" },
    text: { primary: "#171717", secondary: "#525252" },
    divider: "rgba(23,23,23,0.1)",
    success: { main: "#3F3F3F" },
    error: { main: "#B42318" },
    warning: { main: "#525252" },
    info: { main: "#737373" },
    sidebarBg: "#FAFAF8",
    sidebarText: "#171717",
    sidebarActiveBg: "#ECEBE7",
    cardBg: "#FFFFFF",
    hoverBg: "#ECEBE7",
    codeBg: "#F6F5F2",
    brandBar: "#171717",
  },
};

const SUZUKA_THEME: ThemeDefinition = {
  id: "suzuka",
  name: "铃鹿",
  description: "夜空下的先头景色——红橙发色的逃亡者。风、心跳、只有自己的世界。",
  palette: {
    mode: "dark",
    primary: { main: "#D96C4A", light: "#E48A6C", dark: "#B35136", contrastText: "#1A0E0A" },
    secondary: { main: "#4FA3B8" },
    background: { default: "#08090A", paper: "#0E1013" },
    text: { primary: "#E9E6E0", secondary: "#8B8F98" },
    divider: "#1F2125",
    success: { main: "#5BBF9A" },
    error: { main: "#E05A5A" },
    warning: { main: "#E0A35A" },
    info: { main: "#5AA8E0" },
    sidebarBg: "#0A0B0D",
    sidebarText: "#E9E6E0",
    sidebarActiveBg: "rgba(217,108,74,0.16)",
    cardBg: "#0E1013",
    hoverBg: "rgba(79,163,184,0.10)",
    codeBg: "#050607",
    brandBar: "#D96C4A",
  },
};

const SUZUKA_LIVE_THEME: ThemeDefinition = {
  id: "suzuka-live",
  name: "决胜服",
  description: "胜者舞台的决胜服——白底绿金，聚光灯下的荣光。",
  palette: {
    mode: "light",
    primary: { main: "#3E8E4F", light: "#5BA96C", dark: "#2C6B3A", contrastText: "#FFFFFF" },
    secondary: { main: "#D9A93E" },
    background: { default: "#F4F6F1", paper: "#FFFFFF" },
    text: { primary: "#1F2E22", secondary: "#5A6B5F" },
    divider: "rgba(62,142,79,0.16)",
    success: { main: "#2F855A" },
    error: { main: "#C0392B" },
    warning: { main: "#D9A93E" },
    info: { main: "#5A6B5F" },
    sidebarBg: "#EEF3EC",
    sidebarText: "#1F2E22",
    sidebarActiveBg: "#DCEADF",
    cardBg: "#FFFFFF",
    hoverBg: "#EDF4EE",
    codeBg: "#F0F4EF",
    brandBar: "#3E8E4F",
  },
};

export const THEMES: ThemeDefinition[] = [DEFAULT_THEME, LIGHT_THEME, SUZUKA_THEME, SUZUKA_LIVE_THEME];

export function getTheme(id?: string | null): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

export function parseCustomColors(raw?: string | null): CustomColors {
  if (!raw || !raw.trim()) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return {};
    const rec = value as Record<string, unknown>;
    const out: CustomColors = {};
    if (isHex(rec.primary)) out.primary = rec.primary;
    if (isHex(rec.background)) out.background = rec.background;
    if (isHex(rec.text)) out.text = rec.text;
    return out;
  } catch {
    return {};
  }
}

export function serializeCustomColors(colors: CustomColors): string {
  const out: CustomColors = {};
  if (isHex(colors.primary)) out.primary = colors.primary;
  if (isHex(colors.background)) out.background = colors.background;
  if (isHex(colors.text)) out.text = colors.text;
  return Object.keys(out).length ? JSON.stringify(out) : "";
}

function clonePalette(palette: ThemePalette): ThemePalette {
  return {
    ...palette,
    primary: { ...palette.primary },
    secondary: { ...palette.secondary },
    background: { ...palette.background },
    text: { ...palette.text },
    success: palette.success ? { ...palette.success } : undefined,
    error: palette.error ? { ...palette.error } : undefined,
    warning: palette.warning ? { ...palette.warning } : undefined,
    info: palette.info ? { ...palette.info } : undefined,
  };
}

function applyPrimary(palette: ThemePalette, hex: string) {
  palette.primary = { ...palette.primary, main: hex, contrastText: hexContrast(hex) };
  palette.brandBar = hex;
}

/**
 * 优先级：自定义颜色 > brand_color > 主题定义。
 * 出厂 brand_color（#171717）不覆盖主题自带主色，避免把铃鹿的发色盖掉。
 */
export function resolveThemePalette(
  themeId?: string | null,
  brandColor?: string | null,
  customColorsRaw?: string | null,
): ThemePalette {
  const palette = clonePalette(getTheme(themeId).palette);
  const custom = parseCustomColors(customColorsRaw);
  if (isHex(brandColor) && brandColor.toLowerCase() !== STOCK_BRAND_COLOR.toLowerCase()) {
    applyPrimary(palette, brandColor);
  }
  if (isHex(custom.primary)) applyPrimary(palette, custom.primary);
  if (isHex(custom.background)) {
    palette.background = { ...palette.background, default: custom.background };
  }
  if (isHex(custom.text)) {
    palette.text = { ...palette.text, primary: custom.text };
  }
  return palette;
}

export function themeCssVars(palette: ThemePalette): Record<string, string> {
  const sidebarBg = palette.sidebarBg ?? palette.background.paper;
  const sidebarText = palette.sidebarText ?? palette.text.primary;
  const cardBg = palette.cardBg ?? palette.background.paper;
  const hoverBg = palette.hoverBg ?? palette.background.default;
  const codeBg = palette.codeBg ?? palette.background.default;
  const brandBar = palette.brandBar ?? palette.primary.main;
  return {
    "--ed-sidebar-bg": sidebarBg,
    "--ed-sidebar-text": sidebarText,
    "--ed-sidebar-active-bg": palette.sidebarActiveBg ?? hoverBg,
    "--ed-card-bg": cardBg,
    "--ed-hover-bg": hoverBg,
    "--ed-code-bg": codeBg,
    "--ed-brand-bar": brandBar,
    "--ed-bg": palette.background.default,
    "--ed-paper": palette.background.paper,
    "--ed-text": palette.text.primary,
    "--ed-text-2": palette.text.secondary,
    "--ed-primary": palette.primary.main,
    "--bg": palette.background.default,
    "--panel": sidebarBg,
    "--surface": cardBg,
    "--hover": hoverBg,
    "--text": palette.text.primary,
    "--text-2": palette.text.primary,
    "--text-3": palette.text.secondary,
    "--brand": brandBar,
    "--line": palette.divider,
    "--background": palette.background.default,
    "--foreground": palette.text.primary,
    "--card": cardBg,
    "--primary": palette.primary.main,
  };
}

export const SUZUKA_SKY = [
  "radial-gradient(1200px 520px at 10% -12%, rgba(217,108,74,0.18), transparent 56%)",
  "radial-gradient(900px 420px at 92% -8%, rgba(79,163,184,0.14), transparent 52%)",
  "radial-gradient(720px 380px at 48% 118%, rgba(91,191,154,0.10), transparent 48%)",
].join(", ");
