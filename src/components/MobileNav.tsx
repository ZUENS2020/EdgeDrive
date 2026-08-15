"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNav({ siteName }: { siteName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-open", open);
    return () => document.body.classList.remove("sidebar-open");
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest(".sidebar a, .sidebar .tree-item, .sidebar [data-slot='button']")) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <>
      <div className="mobile-bar">
        <Button
          variant="outline"
          size="sm"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
          {open ? "关闭" : "菜单"}
        </Button>
        <strong>{siteName}</strong>
        <span className="header-sp" />
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">文件</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/usage">统计</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/settings">设置</Link>
        </Button>
      </div>
      <button
        type="button"
        className={`sidebar-mask ${open ? "on" : ""}`}
        aria-label="关闭菜单"
        onClick={() => setOpen(false)}
      />
    </>
  );
}
