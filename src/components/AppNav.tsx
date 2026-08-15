"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesColumnIncreasing, Files, LogOut, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { PRODUCT_ADMIN_SUBTITLE, PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AppBrand() {
  return (
    <div className="brand">
      <div className="logo">{PRODUCT_SHORT}</div>
      <div>
        <div className="brand-name">{PRODUCT_NAME}</div>
        <div className="brand-sub">{PRODUCT_ADMIN_SUBTITLE}</div>
      </div>
    </div>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const filesOn = pathname === "/admin";
  const usageOn = pathname.startsWith("/admin/usage");
  const settingsOn = pathname.startsWith("/admin/settings");
  return (
    <nav className="nav">
      <div className="nav-label">工作区</div>
      <Link className={cn("nav-item", filesOn && "active")} href="/admin">
        <Files />
        文件
      </Link>
      <Link className={cn("nav-item", usageOn && "active")} href="/admin/usage">
        <ChartNoAxesColumnIncreasing />
        统计
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
