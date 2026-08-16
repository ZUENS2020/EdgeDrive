import { createTheme } from "@mui/material/styles";
import { RefineThemes } from "@refinedev/mui";
import {
  getTheme,
  resolveThemePalette,
  SUZUKA_SKY,
  themeCssVars,
  type Appearance,
  type ThemePalette,
} from "@/lib/themes";

declare module "@mui/material/styles" {
  interface Palette {
    sidebarBg: string;
    sidebarText: string;
    sidebarActiveBg: string;
    cardBg: string;
    hoverBg: string;
    codeBg: string;
    brandBar: string;
  }
  interface PaletteOptions {
    sidebarBg?: string;
    sidebarText?: string;
    sidebarActiveBg?: string;
    cardBg?: string;
    hoverBg?: string;
    codeBg?: string;
    brandBar?: string;
  }
}

export function createAdminTheme(appearance: Partial<Appearance> = {}) {
  const def = getTheme(appearance.theme_name);
  const palette = resolveThemePalette(appearance.theme_name);
  const isSuzuka = def.id === "suzuka";
  const sky = isSuzuka ? SUZUKA_SKY : "none";
  const sidebarBg = palette.sidebarBg ?? palette.background.paper;
  const sidebarText = palette.sidebarText ?? palette.text.primary;
  const sidebarActiveBg = palette.sidebarActiveBg ?? palette.hoverBg ?? palette.background.default;
  const cardBg = palette.cardBg ?? palette.background.paper;
  const hoverBg = palette.hoverBg ?? palette.background.default;
  const codeBg = palette.codeBg ?? palette.background.default;
  const brandBar = palette.brandBar ?? palette.primary.main;

  return createTheme({
    ...RefineThemes.Blue,
    palette: {
      ...RefineThemes.Blue.palette,
      mode: palette.mode,
      primary: palette.primary,
      secondary: { main: palette.secondary.main },
      background: palette.background,
      text: palette.text,
      divider: palette.divider,
      success: palette.success,
      error: palette.error,
      warning: palette.warning,
      info: palette.info,
      sidebarBg,
      sidebarText,
      sidebarActiveBg,
      cardBg,
      hoverBg,
      codeBg,
      brandBar,
    },
    typography: {
      fontFamily: 'var(--font-noto), "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif',
      h1: { fontSize: 22, fontWeight: 600 },
      h2: { fontSize: 18, fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: palette.mode },
          body: {
            backgroundColor: palette.background.default,
            backgroundImage: sky,
            backgroundAttachment: "fixed",
          },
        },
      },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none", backgroundColor: cardBg },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { backgroundImage: "none", backgroundColor: cardBg },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: sidebarBg,
            color: sidebarText,
            boxShadow: "none",
            borderBottom: `1px solid ${palette.divider}`,
            backgroundImage: "none",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${palette.divider}`,
            backgroundColor: sidebarBg,
            color: sidebarText,
            backgroundImage: isSuzuka ? sky : "none",
            borderTop: isSuzuka ? `3px solid ${brandBar}` : undefined,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            "&:hover": { backgroundColor: hoverBg },
            "&.Mui-selected": {
              backgroundColor: sidebarActiveBg,
              "&:hover": { backgroundColor: sidebarActiveBg },
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:nth-of-type(even)": { backgroundColor: codeBg },
            "&.MuiTableRow-hover:hover": { backgroundColor: hoverBg },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundImage: "none", backgroundColor: cardBg },
        },
      },
    },
  });
}

export function appearanceCssVars(appearance: Partial<Appearance>): Record<string, string> {
  return themeCssVars(resolveThemePalette(appearance.theme_name));
}

export function paletteOf(appearance: Partial<Appearance>): ThemePalette {
  return resolveThemePalette(appearance.theme_name);
}
