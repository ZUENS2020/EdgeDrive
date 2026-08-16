import { createTheme } from "@mui/material/styles";
import { RefineThemes } from "@refinedev/mui";

export function createAdminTheme(brand = "#171717") {
  return createTheme({
    ...RefineThemes.Blue,
    palette: {
      ...RefineThemes.Blue.palette,
      mode: "light",
      primary: { main: brand, contrastText: "#fafafa" },
      background: { default: "#f6f5f2", paper: "#ffffff" },
      text: { primary: "#171717", secondary: "#525252" },
      divider: "rgba(23,23,23,0.1)",
    },
    typography: {
      fontFamily: 'var(--font-noto), "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif',
      h1: { fontSize: 22, fontWeight: 600 },
      h2: { fontSize: 18, fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundColor: "#fff", color: "#171717", boxShadow: "none", borderBottom: "1px solid rgba(23,23,23,0.08)" },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { borderRight: "1px solid rgba(23,23,23,0.08)", backgroundColor: "#fafaf8" },
        },
      },
    },
  });
}
