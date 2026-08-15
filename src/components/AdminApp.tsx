"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Upload } from "lucide-react";
import { applyBrandColor } from "@/lib/brand";
import { copyToClipboard } from "@/lib/clipboard";
import type { AuthMode, FileView, FolderNode, SiteSettings, StatsPayload } from "@/lib/types";
import { flattenFolderPaths } from "@/lib/types";
import { BatchBar } from "./BatchBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { ExpireDialog, type ExpireSubmit } from "./ExpireDialog";
import { FileTable } from "./FileTable";
import { MoveDialog } from "./MoveDialog";
import { PaginationBar } from "./PaginationBar";
import { PromptDialog } from "./PromptDialog";
import { Sidebar } from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PART = 8 * 1024 * 1024;

type Filter = "all" | "ok" | "soon" | "expired";

export function AdminApp({
  initialSettings,
  authMode,
}: {
  initialSettings: SiteSettings;
  authMode: AuthMode;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [files, setFiles] = useState<FileView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expireOpen, setExpireOpen] = useState(false);
  const [expireIds, setExpireIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; body: string; ok: string; run: () => void } | null>(null);
  const [prompt, setPrompt] = useState<{
    title: string;
    label: string;
    value: string;
    run: (name: string) => void;
  } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [pageDrop, setPageDrop] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    else if (path != null) params.set("path", path);
    params.set("filter", filter);
    params.set("page", String(page));
    params.set("pageSize", String(settings.page_size));
    const [fileRes, folderRes, statsRes, settingsRes] = await Promise.all([
      fetch(`/api/files?${params}`),
      fetch("/api/folders"),
      fetch("/api/stats"),
      fetch("/api/settings"),
    ]);
    if (fileRes.ok) {
      const data = (await fileRes.json()) as { files?: FileView[]; total?: number };
      setFiles(data.files || []);
      setTotal(data.total || 0);
    }
    if (folderRes.ok) {
      const data = (await folderRes.json()) as { folders?: FolderNode[] };
      setFolders(data.folders || []);
    }
    if (statsRes.ok) setStats(await statsRes.json());
    if (settingsRes.ok) {
      const data = (await settingsRes.json()) as { settings?: SiteSettings };
      if (data.settings) setSettings(data.settings);
    }
    setLoading(false);
  }, [filter, page, path, q, settings.page_size]);

  useEffect(() => {
    applyBrandColor(settings.brand_color);
  }, [settings.brand_color]);

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(total / settings.page_size));
    if (page > pages) setPage(pages);
  }, [page, settings.page_size, total]);

  useEffect(() => {
    const t = setTimeout(load, q ? 180 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault();
        document.getElementById("q")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedList = useMemo(() => files.filter((f) => selected.has(f.id)), [files, selected]);

  async function batch(body: Record<string, unknown>) {
    const res = await fetch("/api/files/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error || "操作失败");
      return;
    }
    setSelected(new Set());
    await load();
  }

  async function applyExpire(ids: string[], payload: ExpireSubmit) {
    if (payload.action === "permanent") await batch({ ids, action: "permanent" });
    else if (payload.action === "expireNow") await batch({ ids, action: "expireNow" });
    else await batch({ ids, action: "expire", hours: payload.hours, days: payload.days, expires: payload.expires });
    setExpireOpen(false);
  }

  async function patchFiles(body: Record<string, unknown>) {
    const res = await fetch("/api/files", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      const map: Record<string, string> = {
        "file-exists": "目标位置已有同名文件",
        "folder-not-found": "文件夹不存在",
        "rename-single": "一次只能改一个文件名",
      };
      toast.error(map[err.error || ""] || err.error || "操作失败");
      return false;
    }
    await load();
    return true;
  }

  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    const folder = path || "";
    const ids: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      setProgress({ label: `上传 ${file.name}（${i + 1}/${arr.length}）`, pct: 0 });
      try {
        const uploaded = await uploadOne(file, folder, (pct) =>
          setProgress({ label: `上传 ${file.name}（${i + 1}/${arr.length}）`, pct }),
        );
        if (uploaded.id) ids.push(uploaded.id);
      } catch (err) {
        toast.error(`${file.name}: ${String(err)}`);
      }
    }
    setProgress(null);
    await load();
    if (ids.length) {
      setSelected(new Set(ids));
      toast.success(`已上传 ${ids.length} 个并勾选`);
    }
  }

  function onCreateFolder(parentId: string) {
    setPrompt({
      title: parentId ? "新建子文件夹" : "新建文件夹",
      label: "文件夹名称",
      value: "",
      run: async (name) => {
        const res = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, parent_id: parentId }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(err.error || "创建失败");
          return;
        }
        toast.success("文件夹已创建");
        await load();
      },
    });
  }

  function onRenameFolder(id: string, name: string) {
    setPrompt({
      title: "重命名文件夹",
      label: "新名称",
      value: name,
      run: async (next) => {
        const res = await fetch("/api/folders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: next }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(err.error || "重命名失败");
          return;
        }
        toast.success("已重命名");
        await load();
      },
    });
  }

  function onDeleteFolder(id: string, folderPath: string, name: string) {
    setConfirm({
      title: "删除文件夹",
      body: `确定删除「${name}」及其内所有文件？此操作无法撤销。`,
      ok: "删除",
      run: async () => {
        const res = await fetch(`/api/folders?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(err.error || "删除失败");
          return;
        }
        if (path === folderPath || (path && path.startsWith(`${folderPath}/`))) setPath(null);
        toast.success("文件夹已删除");
        await load();
      },
    });
  }

  return (
    <div
      className="app"
      style={{ ["--brand" as string]: settings.brand_color }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setPageDrop(true);
        }
      }}
      onDragLeave={() => setPageDrop(false)}
      onDrop={(e) => {
        e.preventDefault();
        setPageDrop(false);
        if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      <Sidebar
        settings={settings}
        folders={folders}
        currentPath={path}
        stats={stats}
        onSelectPath={(p) => {
          setPath(p);
          setQ("");
          setPage(1);
          setSelected(new Set());
        }}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onUpload={() => fileInput.current?.click()}
        onPickFiles={uploadFiles}
        showLogout={authMode !== "access"}
      />
      <div className="main">
        <div className="header">
          <h1>{q.trim() ? "搜索" : path == null ? "全部文件" : path || "根目录"}</h1>
          <span className="count-pill">{total}</span>
          <div className="header-sp" />
          <Button className="mobile-upload" type="button" onClick={() => fileInput.current?.click()}>
            <Upload />
            上传
          </Button>
          <div className="search">
            <Search />
            <Input
              id="q"
              type="search"
              className="pl-8"
              placeholder="搜索文件名"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className={cn("content", selected.size && "has-sel")}>
          {progress && (
            <div className="progress-wrap on">
              <div className="progress-meta">
                <span>{progress.label}</span>
                <span>{progress.pct}%</span>
              </div>
              <div className="bar">
                <i style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
          )}
          <div className="filters">
            {(["all", "ok", "soon", "expired"] as Filter[]).map((f) => (
              <button
                key={f}
                className={cn("filter", filter === f && "on")}
                data-f={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setPage(1);
                }}
              >
                {f === "all" ? "全部" : f === "ok" ? "正常" : f === "soon" ? "即将过期" : "已过期"}
              </button>
            ))}
          </div>
          <FileTable
            files={files}
            loading={loading}
            selected={selected}
            onToggle={(id) => {
              const next = new Set(selected);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              setSelected(next);
            }}
            onToggleAll={() => {
              if (files.every((f) => selected.has(f.id))) setSelected(new Set());
              else setSelected(new Set(files.map((f) => f.id)));
            }}
            onExpire={(id) => {
              setExpireIds([id]);
              setExpireOpen(true);
            }}
            onCopy={async (url, kind) => {
              const ok = await copyToClipboard(url);
              if (ok) toast.success(kind === "view" ? "已复制预览链接" : "已复制下载链接");
              else toast.error("复制失败，请手动复制");
            }}
            onRename={(file) => {
              setPrompt({
                title: "重命名文件",
                label: "新文件名",
                value: file.name,
                run: async (name) => {
                  const ok = await patchFiles({ id: file.id, name });
                  if (ok) toast.success("已改名");
                },
              });
            }}
            onMove={(file) => {
              setMoveIds([file.id]);
              setMoveOpen(true);
            }}
          />
          <PaginationBar page={page} pageSize={settings.page_size} total={total} onPage={setPage} />
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <BatchBar
        count={selected.size}
        onExpire={() => {
          setExpireIds([...selected]);
          setExpireOpen(true);
        }}
        onPermanent={() => batch({ ids: [...selected], action: "permanent" })}
        onExpireNow={() => batch({ ids: [...selected], action: "expireNow" })}
        onMove={() => {
          setMoveIds([...selected]);
          setMoveOpen(true);
        }}
        onDelete={() =>
          setConfirm({
            title: "批量删除",
            body: `确定删除 ${selected.size} 个文件？此操作无法撤销。`,
            ok: "删除",
            run: () => batch({ ids: [...selected], action: "delete" }),
          })
        }
        onClear={() => setSelected(new Set())}
      />
      <ExpireDialog
        open={expireOpen}
        count={expireIds.length || selectedList.length}
        onClose={() => setExpireOpen(false)}
        onSubmit={(payload) => applyExpire(expireIds.length ? expireIds : [...selected], payload)}
      />
      <MoveDialog
        open={moveOpen}
        count={moveIds.length}
        folders={flattenFolderPaths(folders)}
        onClose={() => setMoveOpen(false)}
        onSubmit={async (path) => {
          setMoveOpen(false);
          const ok = await patchFiles({ ids: moveIds, path });
          if (ok) {
            setSelected(new Set());
            toast.success("已移动");
          }
        }}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        body={confirm?.body || ""}
        ok={confirm?.ok}
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const run = confirm?.run;
          setConfirm(null);
          run?.();
        }}
      />
      <PromptDialog
        open={!!prompt}
        title={prompt?.title || ""}
        label={prompt?.label || ""}
        defaultValue={prompt?.value}
        onClose={() => setPrompt(null)}
        onSubmit={(value) => {
          const run = prompt?.run;
          setPrompt(null);
          run?.(value);
        }}
      />
      <div className={`page-drop ${pageDrop ? "on" : ""}`}>放开以上传</div>
    </div>
  );
}

async function uploadOne(file: File, folderPath: string, onPct: (n: number) => void): Promise<{ id?: string }> {
  const key = folderPath ? `${folderPath}/${file.name}` : file.name;
  if (file.size <= PART) {
    const params = new URLSearchParams({ name: file.name, path: folderPath });
    const res = await fetch(`/api/files/upload?${params}`, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || res.statusText);
    }
    onPct(100);
    return (await res.json()) as { id?: string };
  }

  let uploadId = "";
  try {
    const create = await fetch(`/api/files/mpu?action=create&key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!create.ok) {
      const err = (await create.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || "mpu create failed");
    }
    const created = (await create.json()) as { uploadId: string };
    uploadId = created.uploadId;
    const parts: { partNumber: number; etag: string }[] = [];
    const total = Math.ceil(file.size / PART);
    for (let i = 0; i < total; i++) {
      const blob = file.slice(i * PART, Math.min(file.size, (i + 1) * PART));
      const partRes = await fetch(
        `/api/files/mpu?action=part&key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${i + 1}`,
        { method: "PUT", body: blob },
      );
      if (!partRes.ok) throw new Error("part failed");
      const uploaded = (await partRes.json()) as { etag?: string; ETag?: string };
      parts.push({ partNumber: i + 1, etag: uploaded.etag || uploaded.ETag || "" });
      onPct(Math.round(((i + 1) / total) * 100));
    }
    const done = await fetch(
      `/api/files/mpu?action=complete&key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      },
    );
    if (!done.ok) {
      const err = (await done.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || "complete failed");
    }
    return (await done.json()) as { id?: string };
  } catch (err) {
    if (uploadId) {
      await fetch(`/api/files/mpu?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
    throw err;
  }
}
