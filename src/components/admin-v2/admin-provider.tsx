"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { AppLocale, AppSettingsDto, ThemeId } from "@/lib/v2-contracts";

type AdminContextValue = {
  locale: AppLocale;
  theme: ThemeId;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: ThemeId) => void;
  appearanceSaving: boolean;
  toggleLocale: () => Promise<void>;
  cycleTheme: () => Promise<void>;
  t: (zh: string, en: string) => string;
};

const AdminContext = createContext<AdminContextValue | null>(null);
const themes: ThemeId[] = ["onyx", "porcelain", "nocturne"];

export function AdminProvider({ settings, children }: { settings: AppSettingsDto; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } } }));
  const [theme, setThemeState] = useState<ThemeId>(settings.themeName);
  const [locale, setLocaleState] = useState<AppLocale>(settings.language);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale, theme]);

  const saveAppearance = useCallback(async (patch: { themeName?: ThemeId; language?: AppLocale }) => {
    if (appearanceSaving) return;
    const previousTheme = theme;
    const previousLocale = locale;
    if (patch.themeName) setThemeState(patch.themeName);
    if (patch.language) setLocaleState(patch.language);
    setAppearanceSaving(true);
    try {
      const response = await api<{ data: AppSettingsDto }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
        keepalive: true,
      });
      setThemeState(response.data.themeName);
      setLocaleState(response.data.language);
      client.setQueryData(["settings"], response);
      toast.success(response.data.language === "zh" ? "外观设置已保存" : "Appearance saved");
    } catch (error) {
      setThemeState(previousTheme);
      setLocaleState(previousLocale);
      toast.error(error instanceof Error ? error.message : "settings-failed");
    } finally {
      setAppearanceSaving(false);
    }
  }, [appearanceSaving, client, locale, theme]);

  const cycleTheme = useCallback(async () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length]!;
    await saveAppearance({ themeName: next });
  }, [saveAppearance, theme]);

  const toggleLocale = useCallback(async () => {
    await saveAppearance({ language: locale === "zh" ? "en" : "zh" });
  }, [locale, saveAppearance]);

  const value = useMemo<AdminContextValue>(() => ({
    locale,
    theme,
    setLocale: setLocaleState,
    setTheme: setThemeState,
    appearanceSaving,
    toggleLocale,
    cycleTheme,
    t: (zh, en) => locale === "zh" ? zh : en,
  }), [appearanceSaving, cycleTheme, locale, theme, toggleLocale]);
  return <QueryClientProvider client={client}><AdminContext.Provider value={value}>{children}</AdminContext.Provider></QueryClientProvider>;
}

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside AdminProvider");
  return value;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { code?: string } | string };
    const code = typeof body.error === "string" ? body.error : body.error?.code;
    throw new Error(code || `request-${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
