"use client";

import type { FolderNode, SiteSettings, StatsPayload } from "@/lib/types";
import { AppBrand, AppNav, LogoutButton } from "./AppNav";
import { FolderTree } from "./FolderTree";
import { StatsPanel } from "./StatsPanel";
import { UploadDropzone } from "./UploadDropzone";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

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
  onDeleteFolder: (id: string, path: string, name: string) => void;
  onUpload: () => void;
  onPickFiles: (files: FileList | File[]) => void;
}) {
  return (
    <aside className="sidebar">
      <AppBrand settings={settings} />
      <AppNav />
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
        <UploadDropzone
          onFiles={onPickFiles}
          hint={`多选 · 默认 ${settings.default_expires === "permanent" ? "永久" : settings.default_expires}`}
        />
        <Button className="w-full" type="button" onClick={onUpload}>
          <Upload />
          上传文件
        </Button>
        <LogoutButton />
      </div>
    </aside>
  );
}
