"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { Refine } from "@refinedev/core";
import { RefineSnackbarProvider, useNotificationProvider } from "@refinedev/mui";
import routerProvider from "@refinedev/nextjs-router";
import type { ReactNode } from "react";
import { authProvider } from "@/lib/refine/auth-provider";
import { dataProvider } from "@/lib/refine/data-provider";
import { createAdminTheme } from "@/lib/refine/theme";
import { AdminShell } from "./AdminShell";

export function AdminProviders({
  children,
  brandColor,
}: {
  children: ReactNode;
  brandColor: string;
}) {
  return (
    <ThemeProvider theme={createAdminTheme(brandColor)}>
      <CssBaseline />
      <RefineSnackbarProvider>
        <RefineApp brandColor={brandColor}>{children}</RefineApp>
      </RefineSnackbarProvider>
    </ThemeProvider>
  );
}

function RefineApp({ children, brandColor }: { children: ReactNode; brandColor: string }) {
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
      <AdminShell brandColor={brandColor}>{children}</AdminShell>
    </Refine>
  );
}
