"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  Check, ChevronDown, Copy, Download, Edit3, Eye, File as FileIcon, FolderPlus, Grid2X2, List,
  MoreHorizontal, MoveRight, RefreshCw, Search, Share2, Star, Trash2, Upload, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ApiListResponse, FileDto, FileScope, FolderDto, ShareDto } from "@/lib/v2-contracts";
import { api, useAdmin } from "./admin-provider";

type UploadState = { name: string; progress: number; stage: string };

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const unit = Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** unit).toFixed(unit ? 1 : 0)} ${["B", "KB", "MB", "GB", "TB"][unit]}`;
}

function flattenFolders(nodes: FolderDto[]): FolderDto[] {
  return nodes.flatMap((node) => [node, ...flattenFolders(node.children)]);
}

function hashFile(file: File, onProgress: (value: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../workers/hash.worker.ts", import.meta.url), { type: "module" });
    const id = crypto.randomUUID();
    worker.onmessage = (event: MessageEvent<{ id: string; digest?: string; progress?: number; error?: string }>) => {
      if (event.data.id !== id) return;
      if (event.data.progress != null) onProgress(event.data.progress);
      if (event.data.digest) { worker.terminate(); resolve(event.data.digest); }
      if (event.data.error) { worker.terminate(); reject(new Error(event.data.error)); }
    };
    worker.onerror = () => { worker.terminate(); reject(new Error("hash-worker-failed")); };
    worker.postMessage({ id, file });
  });
}

export function FileManagerV2() {
  const searchParams = useSearchParams();
  const scope = (searchParams.get("scope") || "all") as FileScope;
  const folderId = searchParams.get("folderId");
  const { t } = useAdmin();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<"list" | "grid">("list");
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dialog, setDialog] = useState<"folder" | "move" | "expire" | null>(null);
  const [folderName, setFolderName] = useState("");
  const [destination, setDestination] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [visibleRows, setVisibleRows] = useState<FileDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setDebounced(search.trim()), 260); return () => clearTimeout(timer); }, [search]);
  useEffect(() => setSelected([]), [scope, folderId]);

  const files = useQuery({
    queryKey: ["files", scope, folderId, debounced],
    queryFn: () => {
      const params = new URLSearchParams({ scope });
      if (folderId) params.set("folderId", folderId);
      if (debounced) params.set("q", debounced);
      return api<ApiListResponse<FileDto>>(`/api/admin/files?${params}`);
    },
  });
  const folders = useQuery({ queryKey: ["folders"], queryFn: () => api<{ data: FolderDto[] }>("/api/admin/folders") });
  const trashFolders = useQuery({ queryKey: ["folders", "trash"], queryFn: () => api<{ data: FolderDto[] }>("/api/admin/folders?trash=1"), enabled: scope === "trash" });
  const flatFolders = useMemo(() => flattenFolders(folders.data?.data || []), [folders.data]);
  useEffect(() => { setVisibleRows(files.data?.data || []); setNextCursor(files.data?.meta.nextCursor || null); }, [files.data]);
  const rows = visibleRows;
  const allSelected = rows.length > 0 && rows.every((file) => selected.includes(file.id));
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["files"] }),
    queryClient.invalidateQueries({ queryKey: ["folders"] }),
    queryClient.invalidateQueries({ queryKey: ["overview"] }),
  ]);

  const runAction = async (body: Record<string, unknown>) => {
    try {
      await api("/api/admin/files/actions", { method: "POST", body: JSON.stringify({ ...body, ids: selected }) });
      toast.success(t("操作已完成", "Action completed"));
      setSelected([]);
      setDialog(null);
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : t("操作失败", "Action failed")); }
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await api("/api/admin/folders", { method: "POST", body: JSON.stringify({ name: folderName, parentId: folderId }) });
      setFolderName(""); setDialog(null); await refresh(); toast.success(t("文件夹已创建", "Folder created"));
    } catch (error) { toast.error(error instanceof Error ? error.message : "create-failed"); }
  };

  const shareFiles = async () => {
    try {
      const response = await api<{ data: ShareDto }>("/api/admin/shares", { method: "POST", body: JSON.stringify({ fileIds: selected, allowDownload: true, allowPreview: true }) });
      const url = new URL(response.data.previewUrl, location.origin).toString();
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success(t("预览链接已复制", "Preview link copied"));
    } catch (error) { toast.error(error instanceof Error ? error.message : "share-failed"); }
  };

  const uploadFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    for (const file of Array.from(list)) {
      let uploadSessionId: string | null = null;
      const setProgress = (progress: number, stage: string) => setUploads((items) => [
        ...items.filter((item) => item.name !== file.name), { name: file.name, progress, stage },
      ]);
      try {
        setProgress(0, t("正在计算指纹", "Hashing"));
        const sha256 = await hashFile(file, (progress) => setProgress(progress * 0.18, t("正在计算指纹", "Hashing")));
        const prepared = await api<{ data: { kind: "instant"; file: FileDto } | { kind: "single" | "multipart"; sessionId: string; partSize: number } }>("/api/admin/uploads", {
          method: "POST",
          body: JSON.stringify({ folderId, name: file.name, mime: file.type || null, size: file.size, sha256 }),
        });
        if (prepared.data.kind === "instant") {
          setProgress(1, t("秒传完成", "Instant upload"));
        } else if (prepared.data.kind === "single") {
          uploadSessionId = prepared.data.sessionId;
          setProgress(0.22, t("正在上传", "Uploading"));
          await api(`/api/admin/uploads/${prepared.data.sessionId}`, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
          setProgress(1, t("上传完成", "Complete"));
        } else {
          const { sessionId, partSize } = prepared.data;
          uploadSessionId = sessionId;
          const parts: { partNumber: number; etag: string }[] = [];
          const count = Math.ceil(file.size / partSize);
          let nextPart = 1;
          let completed = 0;
          const uploadWorker = async () => {
            while (nextPart <= count) {
              const partNumber = nextPart;
              nextPart += 1;
              const offset = (partNumber - 1) * partSize;
              const chunk = file.slice(offset, Math.min(file.size, offset + partSize));
              const uploaded = await api<{ data: { partNumber: number; etag: string } }>(`/api/admin/uploads/${sessionId}/parts/${partNumber}`, {
                method: "PUT", body: chunk, headers: { "Content-Type": "application/octet-stream" },
              });
              parts.push(uploaded.data);
              completed += 1;
              setProgress(0.18 + 0.78 * (completed / count), `${t("分片", "Part")} ${completed}/${count}`);
            }
          };
          await Promise.all(Array.from({ length: Math.min(3, count) }, () => uploadWorker()));
          await api(`/api/admin/uploads/${sessionId}`, { method: "POST", body: JSON.stringify({ parts }) });
          setProgress(1, t("上传完成", "Complete"));
        }
        await refresh();
      } catch (error) {
        if (uploadSessionId) await api(`/api/admin/uploads/${uploadSessionId}`, { method: "DELETE" }).catch(() => undefined);
        const code = error instanceof Error ? error.message : "upload-failed";
        const detail = ({
          "internal-error": t("服务器内部错误", "Internal error"),
          "upload-part-failed": t("分片上传失败，请重试", "Part upload failed"),
          "upload-complete-failed": t("合并分片失败，请重试", "Could not complete upload"),
          "upload-body-unreadable": t("上传数据无法读取", "Upload body unreadable"),
          "multipart-init-failed": t("无法开始分片上传", "Could not start multipart upload"),
          "part-too-large": t("分片过大", "Part too large"),
        } as Record<string, string>)[code] || code;
        setProgress(0, detail);
        toast.error(`${file.name}: ${detail}`);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
    setTimeout(() => setUploads((items) => items.filter((item) => item.progress < 1)), 1800);
  };

  const patchFile = async (id: string, patch: Record<string, unknown>) => {
    try { await api(`/api/admin/files/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "update-failed"); }
  };

  const updateFolder = async (id: string, body: Record<string, unknown>) => {
    try { await api(`/api/admin/folders/${id}`, { method: "PATCH", body: JSON.stringify(body) }); await refresh(); toast.success(t("文件夹已更新", "Folder updated")); }
    catch (error) { toast.error(error instanceof Error ? error.message : "folder-update-failed"); }
  };

  const deleteFolder = async (id: string) => {
    if (!window.confirm(t("删除此文件夹及其子目录？文件会进入回收站。", "Trash this folder and its descendants? Files will remain restorable."))) return;
    try { await api(`/api/admin/folders/${id}`, { method: "DELETE" }); location.href = "/admin?scope=all"; }
    catch (error) { toast.error(error instanceof Error ? error.message : "folder-delete-failed"); }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ scope, cursor: nextCursor });
      if (folderId) params.set("folderId", folderId);
      if (debounced) params.set("q", debounced);
      const page = await api<ApiListResponse<FileDto>>(`/api/admin/files?${params}`);
      setVisibleRows((current) => [...current, ...page.data.filter((file) => !current.some((item) => item.id === file.id))]);
      setNextCursor(page.meta.nextCursor);
    } catch (error) { toast.error(error instanceof Error ? error.message : "load-more-failed"); }
    finally { setLoadingMore(false); }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div><p className="eyebrow">OBJECT CATALOG</p><h1>{scope === "trash" ? t("回收站", "Trash") : t("文件", "Files")}</h1><p>{t("稳定对象、引用去重与可控生命周期。", "Stable objects, reference deduplication and controlled lifecycle.")}</p></div>
        <div className="header-actions">
          {folderId ? <><button className="button secondary" onClick={() => { const current = flatFolders.find((folder) => folder.id === folderId); const name = prompt(t("文件夹新名称", "New folder name"), current?.name || ""); if (name) void updateFolder(folderId, { action: "rename", name }); }}><Edit3 size={16} />{t("重命名", "Rename")}</button><button className="button secondary" onClick={() => void deleteFolder(folderId)}><Trash2 size={16} />{t("删除文件夹", "Trash folder")}</button></> : null}
          <button className="button secondary" onClick={() => setDialog("folder")}><FolderPlus size={16} />{t("新建文件夹", "New folder")}</button>
          <button className="button primary" onClick={() => fileInput.current?.click()}><Upload size={16} />{t("上传", "Upload")}</button>
          <input ref={fileInput} hidden multiple type="file" onChange={(event) => void uploadFiles(event.target.files)} />
        </div>
      </header>

      <section className="catalog-panel">
        {scope === "trash" && trashFolders.data?.data.length ? <div className="trashed-folders"><p className="eyebrow">TRASHED FOLDERS</p>{trashFolders.data.data.map((folder) => <div key={folder.id}><span><FolderPlus size={15} /><strong>{folder.path}</strong></span><button className="button secondary" onClick={() => void updateFolder(folder.id, { action: "restore" })}>{t("恢复文件夹", "Restore folder")}</button></div>)}</div> : null}
        <div className="catalog-toolbar">
          <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("搜索文件", "Search files")} />{search ? <button onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button> : null}</label>
          <span className="result-count">{files.data?.meta.total || 0} {t("项", "items")}</span>
          <button className="icon-button" onClick={() => void files.refetch()} aria-label="Refresh"><RefreshCw size={16} /></button>
          <div className="segmented"><button className={view === "list" ? "is-active" : ""} onClick={() => setView("list")} aria-label="List view"><List size={16} /></button><button className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 size={16} /></button></div>
        </div>

        {selected.length ? <div className="selection-bar"><strong>{selected.length} {t("项已选择", "selected")}</strong>
          {scope === "trash" ? <><button onClick={() => void runAction({ action: "restore" })}><Check size={15} />{t("恢复", "Restore")}</button><button className="danger" onClick={() => { if (window.confirm(t("确定永久删除所选文件？此操作不可撤销。", "Permanently delete selected files? This cannot be undone."))) void runAction({ action: "purge" }); }}><Trash2 size={15} />{t("永久删除", "Purge")}</button></> : <>
            <button onClick={() => void shareFiles()}><Share2 size={15} />{t("共享", "Share")}</button>
            <button onClick={() => void runAction({ action: "star", starred: true })}><Star size={15} />{t("星标", "Star")}</button>
            <button onClick={() => setDialog("move")}><MoveRight size={15} />{t("移动/复制", "Move / copy")}</button>
            <button onClick={() => setDialog("expire")}><ChevronDown size={15} />{t("到期时间", "Expiry")}</button>
            <button className="danger" onClick={() => void runAction({ action: "trash" })}><Trash2 size={15} />{t("移到回收站", "Trash")}</button>
          </>}
          <button className="selection-close" onClick={() => setSelected([])} aria-label="Clear selection"><X size={15} /></button>
        </div> : null}

        {files.isLoading ? <div className="empty-state"><RefreshCw className="spin" size={20} />{t("正在读取目录", "Reading catalog")}</div> : rows.length === 0 ? <div className="empty-state"><FileIcon size={24} /><strong>{t("这里还没有文件", "No files here")}</strong><span>{t("上传一个文件，或切换到其他视图。", "Upload a file or switch to another view.")}</span></div> : view === "list" ? (
          <div className="file-table" role="table">
            <div className="file-row file-head" role="row"><label><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((file) => file.id))} /><span>{t("名称", "Name")}</span></label><span>{t("大小", "Size")}</span><span>{t("状态", "State")}</span><span>{t("修改时间", "Modified")}</span><span /></div>
            {rows.map((file) => <div className={`file-row ${selected.includes(file.id) ? "is-selected" : ""}`} role="row" key={file.id}>
              <label className="file-name"><input type="checkbox" checked={selected.includes(file.id)} onChange={() => setSelected((ids) => ids.includes(file.id) ? ids.filter((id) => id !== file.id) : [...ids, file.id])} /><span className="file-glyph"><FileIcon size={17} /></span><span><strong>{file.name}</strong><small>{file.mime || "application/octet-stream"}</small></span></label>
              <span className="mono muted">{formatBytes(file.size)}</span>
              <span><i className={`status-dot ${file.expired ? "bad" : file.expiresAt ? "soon" : ""}`} />{file.expired ? t("已过期", "Expired") : file.expiresAt ? t("有时限", "Timed") : t("永久", "Permanent")}</span>
              <span className="muted">{new Date(file.updatedAt).toLocaleDateString()}</span>
              <div className="row-actions"><button onClick={() => void patchFile(file.id, { starred: !file.starred })} aria-label="Toggle star"><Star size={16} fill={file.starred ? "currentColor" : "none"} /></button><a href={`${file.contentUrl}?inline=1`} target="_blank" aria-label="Preview"><Eye size={16} /></a><a href={file.contentUrl} aria-label="Download"><Download size={16} /></a><button onClick={() => { const name = prompt(t("新名称", "New name"), file.name); if (name) void patchFile(file.id, { name }); }} aria-label="More actions"><MoreHorizontal size={17} /></button></div>
            </div>)}
          </div>
        ) : <div className="file-grid">{rows.map((file) => <article className={`file-card ${selected.includes(file.id) ? "is-selected" : ""}`} key={file.id}><label><input type="checkbox" checked={selected.includes(file.id)} onChange={() => setSelected((ids) => ids.includes(file.id) ? ids.filter((id) => id !== file.id) : [...ids, file.id])} /><span className="file-glyph large"><FileIcon size={25} /></span></label><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)} · {new Date(file.updatedAt).toLocaleDateString()}</span><div><a href={`${file.contentUrl}?inline=1`} target="_blank"><Eye size={15} />{t("预览", "Preview")}</a><a href={file.contentUrl}><Download size={15} /></a></div></article>)}</div>}
        {nextCursor ? <div className="load-more"><button className="button secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <RefreshCw className="spin" size={15} /> : null}{loadingMore ? t("加载中", "Loading") : t("加载更多", "Load more")}</button></div> : null}
      </section>

      {uploads.length ? <aside className="upload-dock"><header><strong>{t("传输队列", "Transfer queue")}</strong><span>{uploads.length}</span></header>{uploads.map((item) => <div key={item.name}><div><span>{item.name}</span><small>{item.stage}</small></div><progress value={item.progress} max={1} /></div>)}</aside> : null}

      {dialog ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section className="dialog-panel" role="dialog" aria-modal="true">
        <header><div><p className="eyebrow">CATALOG ACTION</p><h2>{dialog === "folder" ? t("新建文件夹", "New folder") : dialog === "move" ? t("移动或复制", "Move or copy") : t("设置到期时间", "Set expiry")}</h2></div><button className="icon-button" onClick={() => setDialog(null)}><X size={17} /></button></header>
        {dialog === "folder" ? <label className="field"><span>{t("名称", "Name")}</span><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createFolder(); }} /></label> : null}
        {dialog === "move" ? <label className="field"><span>{t("目标文件夹", "Destination")}</span><select value={destination} onChange={(event) => setDestination(event.target.value)}><option value="">/{t("根目录", "Root")}</option>{flatFolders.map((folder) => <option value={folder.id} key={folder.id}>{folder.path}</option>)}</select></label> : null}
        {dialog === "expire" ? <label className="field"><span>{t("到期时间（留空为永久）", "Expiry (empty is permanent)")}</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label> : null}
        <footer><button className="button secondary" onClick={() => setDialog(null)}>{t("取消", "Cancel")}</button>{dialog === "folder" ? <button className="button primary" onClick={() => void createFolder()}>{t("创建", "Create")}</button> : dialog === "move" ? <><button className="button secondary" onClick={() => void runAction({ action: "copy", folderId: destination || null })}><Copy size={15} />{t("复制", "Copy")}</button><button className="button primary" onClick={() => void runAction({ action: "move", folderId: destination || null })}><MoveRight size={15} />{t("移动", "Move")}</button></> : <button className="button primary" onClick={() => void runAction({ action: "expire", expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null })}>{t("应用", "Apply")}</button>}</footer>
      </section></div> : null}
    </div>
  );
}
