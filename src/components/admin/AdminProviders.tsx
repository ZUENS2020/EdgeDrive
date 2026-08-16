"use client";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider } from "@mui/material/styles";
import { Refine } from "@refinedev/core";
import { RefineSnackbarProvider, useNotificationProvider } from "@refinedev/mui";
import routerProvider from "@refinedev/nextjs-router";
import Box from "@mui/material/Box";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { authProvider } from "@/lib/refine/auth-provider";
import { dataProvider } from "@/lib/refine/data-provider";
import { appearanceCssVars, createAdminTheme } from "@/lib/refine/theme";
import type { Appearance } from "@/lib/themes";
import type { SiteSettings } from "@/lib/types";
import { AdminShell } from "./AdminShell";

const AppearanceContext = createContext<{
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
} | null>(null);

const SiteSettingsContext = createContext<{
  siteSettings: SiteSettings;
  setSiteSettings: (patch: Partial<SiteSettings>) => void;
} | null>(null);

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AdminProviders");
  return ctx;
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within AdminProviders");
  return ctx;
}

export function AdminProviders({
  children,
  initial,
  initialSettings,
}: {
  children: ReactNode;
  initial: Appearance;
  initialSettings: SiteSettings;
}) {
  const [appearance, setAppearanceState] = useState<Appearance>(initial);
  const [siteSettings, setSiteSettingsState] = useState<SiteSettings>(initialSettings);
  const setAppearance = useCallback((patch: Partial<Appearance>) => {
    setAppearanceState((prev) => ({ ...prev, ...patch }));
  }, []);
  const setSiteSettings = useCallback((patch: Partial<SiteSettings>) => {
    setSiteSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);
  const theme = useMemo(() => createAdminTheme(appearance), [appearance]);
  const cssVars = useMemo(() => appearanceCssVars(appearance), [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    const dark = theme.palette.mode === "dark";
    root.classList.toggle("dark", dark);
    root.style.colorScheme = theme.palette.mode;
    for (const [name, value] of Object.entries(cssVars)) {
      root.style.setProperty(name, value);
    }
  }, [cssVars, theme.palette.mode]);

  return (
    <AppearanceContext.Provider value={{ appearance, setAppearance }}>
      <SiteSettingsContext.Provider value={{ siteSettings, setSiteSettings }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GlobalStyles
            styles={{
              "html:root": { ...cssVars, colorScheme: theme.palette.mode },
              body: { color: theme.palette.text.primary, backgroundColor: theme.palette.background.default },
            }}
          />
          <Box
            style={cssVars as CSSProperties}
            sx={{ minHeight: "100vh", color: "text.primary", bgcolor: "background.default" }}
          >
            <RefineSnackbarProvider>
              <RefineApp>{children}</RefineApp>
            </RefineSnackbarProvider>
          </Box>
        </ThemeProvider>
      </SiteSettingsContext.Provider>
    </AppearanceContext.Provider>
  );
}

function RefineApp({ children }: { children: ReactNode }) {
  const notificationProvider = useNotificationProvider();
  return (
    <Refine
      routerProvider={routerProvider}
      dataProvider={dataProvider}
      authProvider={authProvider}
      notificationProvider={notificationProvider}
      options={{
        syncWithLocation: false,
        warnWhenUnsavedChanges: false,
        disableTelemetry: true,
      }}
      resources={[
        { name: "files", list: "/admin", meta: { label: "文件" } },
        { name: "usage", list: "/admin/usage", meta: { label: "统计" } },
        { name: "settings", list: "/admin/settings", meta: { label: "设置" } },
        { name: "folders", meta: { hide: true } },
      ]}
    >
      <AdminShell>{children}</AdminShell>
    </Refine>
  );
}
