"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Files, LogOut, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { SiteSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function AppBrand({ settings }: { settings: SiteSettings }) {
  return (
    <div className="brand">
      <div className="logo">{settings.site_name.slice(0, 1).toUpperCase()}</div>
      <div>
        <div className="brand-name">{settings.site_name}</div>
          <div className="brand-sub">管理</div>
      </div>
    </div>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const filesOn = pathname === "/admin";
  const settingsOn = pathname.startsWith("/admin/settings");
  return (
    <nav className="nav">
      <div className="nav-label">工作区</div>
      <Link className={cn("nav-item", filesOn && "active")} href="/admin">
        <Files />
        文件
      </Link>
      <Link className={cn("nav-item", settingsOn && "active")} href="/admin/settings">
        <Settings />
        设置
      </Link>
    </nav>
  );
}

export function LogoutButton() {
  async function logout() {
    await authClient.signOut();
    window.location.assign("/login");
  }
  return (
    <Button variant="ghost" className="w-full justify-start" type="button" onClick={logout}>
      <LogOut />
      退出登录
    </Button>
  );
}
