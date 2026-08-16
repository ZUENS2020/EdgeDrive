"use client";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider } from "@mui/material/styles";
import { appearanceCssVars, createAdminTheme } from "@/lib/refine/theme";
import { SetupGuide } from "./SetupGuide";

export function SetupProviders({ tokenRequired }: { tokenRequired: boolean }) {
  const theme = createAdminTheme();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{ ":root": appearanceCssVars({}), html: { colorScheme: theme.palette.mode } }} />
      <SetupGuide tokenRequired={tokenRequired} />
    </ThemeProvider>
  );
}
