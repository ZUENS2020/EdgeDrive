"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppLocale, AppSettingsDto, ThemeId } from "@/lib/v2-contracts";

type AdminContextValue = {
  locale: AppLocale;
  theme: ThemeId;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: ThemeId) => void;
  cycleTheme: () => void;
  t: (zh: string, en: string) => string;
};

const AdminContext = createContext<AdminContextValue | null>(null);
const themes: ThemeId[] = ["onyx", "porcelain", "nocturne"];

export function AdminProvider({ settings, children }: { settings: AppSettingsDto; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } } }));
  const [theme, setTheme] = useState<ThemeId>(settings.themeName);
  const [locale, setLocale] = useState<AppLocale>(settings.language);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    localStorage.setItem("edgedrive-theme", theme);
  }, [locale, theme]);
  useEffect(() => {
    const saved = localStorage.getItem("edgedrive-theme") as ThemeId | null;
    if (saved && themes.includes(saved)) setTheme(saved);
  }, []);
  const value = useMemo<AdminContextValue>(() => ({
    locale,
    theme,
    setLocale,
    setTheme,
    cycleTheme: () => setTheme((current) => themes[(themes.indexOf(current) + 1) % themes.length]!),
    t: (zh, en) => locale === "zh" ? zh : en,
  }), [locale, theme]);
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
