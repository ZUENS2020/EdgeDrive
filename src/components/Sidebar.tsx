"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import type { FolderNode, SiteSettings, StatsPayload } from "@/lib/types";
import { Button } from "./ui/Button";
import { FolderTree } from "./FolderTree";
import { StatsPanel } from "./StatsPanel";
import { UploadDropzone } from "./UploadDropzone";

export function Sidebar({
  settings,
  folders,
  currentPath,
  stats,
  onSelectPath,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onUpload,
  onPickFiles,
}: {
  settings: SiteSettings;
  folders: FolderNode[];
  currentPath: string | null;
  stats: StatsPayload | null;
  onSelectPath: (path: string | null) => void;
  onCreateFolder: (parentId: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string, name: string) => void;
  onUpload: () => void;
  onPickFiles: (files: FileList | File[]) => void;
}) {

  async function logout() {
    await authClient.signOut();
    window.location.assign("/login");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">{settings.site_name.slice(0, 1).toUpperCase()}</div>
        <div>
          <div className="brand-name">{settings.site_name}</div>
          <div className="brand-sub">Admin</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-label">工作区</div>
        <Link className="nav-item active" href="/admin">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2.5 4.5h11v8a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-8Z" />
            <path d="M2.5 4.5 4 2.5h3l1.5 2h6" />
          </svg>
          文件
        </Link>
        <Link className="nav-item" href="/admin/settings">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="2.2" />
            <path d="M8 2.5v1.4M8 12.1v1.4M2.5 8h1.4M12.1 8h1.4M4.1 4.1l1 1M10.9 10.9l1 1M11.9 4.1l-1 1M5.1 10.9l-1 1" />
          </svg>
          设置
        </Link>
      </nav>
      <FolderTree
        folders={folders}
        currentPath={currentPath}
        onSelect={onSelectPath}
        onCreate={onCreateFolder}
        onRename={onRenameFolder}
        onDelete={onDeleteFolder}
      />
      <div className="side-foot">
        <StatsPanel stats={stats} />
        <UploadDropzone onFiles={onPickFiles} hint={`多选 · 默认 ${settings.default_expires === "permanent" ? "永久" : settings.default_expires}`} />
        <Button variant="primary" wide type="button" onClick={onUpload}>
          上传文件
        </Button>
        <Button variant="ghost" type="button" onClick={logout}>
          退出登录
        </Button>
      </div>
    </aside>
  );
}
