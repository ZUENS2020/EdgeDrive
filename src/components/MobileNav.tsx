"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
      if (t.closest(".sidebar a, .sidebar .tree-item, .sidebar .btn-primary")) {
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
        <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "关闭" : "菜单"}
        </button>
        <strong>{siteName}</strong>
        <span className="header-sp" />
        <Link className="btn" href="/admin">
          文件
        </Link>
        <Link className="btn" href="/admin/settings">
          设置
        </Link>
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
