"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { createAdminTheme } from "@/lib/refine/theme";
import { SetupGuide } from "./SetupGuide";

export function SetupProviders({ tokenRequired }: { tokenRequired: boolean }) {
  return (
    <ThemeProvider theme={createAdminTheme()}>
      <CssBaseline />
      <SetupGuide tokenRequired={tokenRequired} />
    </ThemeProvider>
  );
}
