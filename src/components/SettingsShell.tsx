"use client";

import type { ReactNode } from "react";
import { AppBrand, AppNav, LogoutButton } from "./AppNav";

export function SettingsShell({
  showLogout = true,
  children,
}: {
  showLogout?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <aside className="sidebar">
        <AppBrand />
        <AppNav />
        <div className="side-foot">
          {showLogout ? <LogoutButton /> : null}
        </div>
      </aside>
      {children}
    </div>
  );
}
