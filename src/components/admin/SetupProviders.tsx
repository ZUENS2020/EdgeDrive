"use client";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider } from "@mui/material/styles";
import { parseLocale, type Locale } from "@/lib/i18n";
import { appearanceCssVars, createAdminTheme } from "@/lib/refine/theme";
import { I18nProvider } from "./I18nProvider";
import { SetupGuide } from "./SetupGuide";

export function SetupProviders({
  tokenRequired,
  locale,
}: {
  tokenRequired: boolean;
  locale?: Locale;
}) {
  const resolved = parseLocale(locale);
  const theme = createAdminTheme({}, resolved);
  return (
    <I18nProvider locale={resolved}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{ ":root": appearanceCssVars({}), html: { colorScheme: theme.palette.mode } }} />
        <SetupGuide tokenRequired={tokenRequired} />
      </ThemeProvider>
    </I18nProvider>
  );
}
