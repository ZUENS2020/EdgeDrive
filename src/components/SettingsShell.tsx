"use client";

import type { ReactNode } from "react";
import type { SiteSettings } from "@/lib/types";
import { AppBrand, AppNav, LogoutButton } from "./AppNav";

export function SettingsShell({
  settings,
  children,
}: {
  settings: SiteSettings;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <aside className="sidebar">
        <AppBrand settings={settings} />
        <AppNav />
        <div className="side-foot">
          <LogoutButton />
        </div>
      </aside>
      {children}
    </div>
  );
}
