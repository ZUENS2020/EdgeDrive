"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Archive, Boxes, Clock3, Cloud, FileClock, Files, Folder, FolderOpen, Gauge, Languages,
  Menu, MoonStar, Settings, Share2, Star, SunMedium, Trash2, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { FolderDto } from "@/lib/v2-contracts";
import { api, useAdmin } from "./admin-provider";

const railItems = [
  { href: "/admin", label: ["文件", "Files"], icon: Files },
  { href: "/admin/shares", label: ["共享", "Shares"], icon: Share2 },
  { href: "/admin/usage", label: ["概览", "Overview"], icon: Gauge },
  { href: "/admin/settings", label: ["设置", "Settings"], icon: Settings },
] as const;

const scopes = [
  { key: "all", label: ["全部文件", "All files"], icon: Boxes },
  { key: "recent", label: ["最近上传", "Recent"], icon: Clock3 },
  { key: "starred", label: ["已加星标", "Starred"], icon: Star },
  { key: "expiring", label: ["即将过期", "Expiring"], icon: FileClock },
  { key: "expired", label: ["已过期", "Expired"], icon: Archive },
  { key: "trash", label: ["回收站", "Trash"], icon: Trash2 },
] as const;

function FolderLinks({ nodes, activeId, depth = 0 }: { nodes: FolderDto[]; activeId: string; depth?: number }) {
  return nodes.map((folder) => (
    <div key={folder.id}>
      <Link className={`context-link ${activeId === folder.id ? "is-active" : ""}`} style={{ paddingLeft: 12 + depth * 14 }} href={`/admin?scope=folder&folderId=${folder.id}`}>
        {activeId === folder.id ? <FolderOpen size={15} /> : <Folder size={15} />}<span>{folder.name}</span>
      </Link>
      {folder.children.length ? <FolderLinks nodes={folder.children} activeId={activeId} depth={depth + 1} /> : null}
    </div>
  ));
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { locale, theme, appearanceSaving, toggleLocale, cycleTheme, t } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const folders = useQuery({
    queryKey: ["folders"],
    queryFn: () => api<{ data: FolderDto[] }>("/api/admin/folders"),
    enabled: pathname === "/admin",
  });
  const scope = search.get("scope") || "all";
  const folderId = search.get("folderId") || "";
  const filesPage = pathname === "/admin";
  const activeTitle = railItems.find((item) => pathname === item.href)?.label || railItems[0].label;
  const ThemeIcon = theme === "porcelain" ? SunMedium : MoonStar;
  return (
    <div className="admin-frame">
      <a className="skip-link" href="#admin-content">{t("跳到主内容", "Skip to content")}</a>
      <header className="mobile-topbar">
        <button className="icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
        <strong>EDGEDRIVE</strong><span>V2</span>
      </header>
      <aside className={`rail ${mobileOpen ? "is-open" : ""}`}>
        <Link href="/admin" className="rail-brand" aria-label="EdgeDrive home"><Cloud size={21} /><span>ED</span></Link>
        <button className="rail-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        <nav aria-label="Primary navigation">
          {railItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`rail-link ${active ? "is-active" : ""}`} title={t(label[0], label[1])}><Icon size={19} /><span>{t(label[0], label[1])}</span></Link>;
          })}
        </nav>
        <div className="rail-tools">
          <button className="rail-link" disabled={appearanceSaving} onClick={() => void toggleLocale()} title="Language"><Languages size={18} /><span>{locale.toUpperCase()}</span></button>
          <button className="rail-link" disabled={appearanceSaving} aria-busy={appearanceSaving} onClick={() => void cycleTheme()} title="Theme"><ThemeIcon size={18} /><span>{theme}</span></button>
        </div>
      </aside>
      <aside className={`context-panel ${mobileOpen ? "is-open" : ""}`}>
        <div className="context-heading"><span className="eyebrow">WORKSPACE</span><h2>{t(activeTitle[0], activeTitle[1])}</h2></div>
        {filesPage ? <nav aria-label="File views">
          {scopes.map(({ key, label, icon: Icon }) => <Link key={key} href={`/admin?scope=${key}`} onClick={() => setMobileOpen(false)} className={`context-link ${scope === key ? "is-active" : ""}`}><Icon size={15} /><span>{t(label[0], label[1])}</span></Link>)}
          <div className="context-separator"><span>{t("文件夹", "Folders")}</span></div>
          <Link className={`context-link ${scope === "folder" && !folderId ? "is-active" : ""}`} href="/admin?scope=folder"><Folder size={15} /><span>{t("根目录", "Root")}</span></Link>
          <FolderLinks nodes={folders.data?.data || []} activeId={folderId} />
        </nav> : <div className="context-note">{pathname.includes("shares") ? t("管理可撤销、可限次的公开链接。", "Manage revocable, limited public links.") : pathname.includes("settings") ? t("外观、语言与保留策略。", "Appearance, language and retention.") : t("基于本地元数据的运行概览。", "Operational view from local metadata.")}</div>}
      </aside>
      <main className="admin-main" id="admin-content" tabIndex={-1}>{children}</main>
      {mobileOpen ? <button className="nav-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> : null}
    </div>
  );
}
