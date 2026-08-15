"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyBrandColor } from "@/lib/brand";
import { copyToClipboard } from "@/lib/clipboard";
import type { FileView, FolderNode, SiteSettings, StatsPayload } from "@/lib/types";
import { BatchBar } from "./BatchBar";
import { ExpireDialog, type ExpireSubmit } from "./ExpireDialog";
import { FileTable } from "./FileTable";
import { Sidebar } from "./Sidebar";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

const PART = 8 * 1024 * 1024;

type Filter = "all" | "ok" | "soon" | "expired";

export function AdminApp({ initialSettings }: { initialSettings: SiteSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [files, setFiles] = useState<FileView[]>([]);
  const [total, setTotal] = useState(0);
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
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [pageDrop, setPageDrop] = useState(false);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    else if (path != null) params.set("path", path);
    params.set("filter", filter);
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
  }, [filter, path, q, settings.page_size]);

  useEffect(() => {
    applyBrandColor(settings.brand_color);
  }, [settings.brand_color]);

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
      alert(err.error || "操作失败");
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
        alert(`${file.name}: ${String(err)}`);
      }
    }
    setProgress(null);
    await load();
    if (ids.length) {
      setSelected(new Set(ids));
      flash(`已上传 ${ids.length} 个并勾选`);
    }
  }

  async function onCreateFolder(parentId: string) {
    const name = window.prompt("文件夹名称");
    if (!name) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      alert(err.error || "创建失败");
      return;
    }
    await load();
  }

  async function onRenameFolder(id: string, name: string) {
    const res = await fetch("/api/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      alert(err.error || "重命名失败");
      return;
    }
    await load();
  }

  function onDeleteFolder(id: string, name: string) {
    setConfirm({
      title: "删除文件夹",
      body: `确定删除「${name}」及其内所有文件？此操作无法撤销。`,
      ok: "删除",
      run: async () => {
        await fetch(`/api/folders?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (path === name || (path && path.startsWith(name + "/"))) setPath(null);
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
          setSelected(new Set());
        }}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onUpload={() => fileInput.current?.click()}
        onPickFiles={uploadFiles}
      />
      <div className="main">
        <div className="header">
          <h1>{q.trim() ? "搜索" : path == null ? "全部文件" : path || "根目录"}</h1>
          <span className="count-pill">{total}</span>
          <div className="header-sp" />
          <Button className="mobile-upload" variant="primary" type="button" onClick={() => fileInput.current?.click()}>
            上传
          </Button>
          <div className="search">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5 14 14" />
            </svg>
            <input id="q" type="search" placeholder="搜索文件名" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className={`content ${selected.size ? "has-sel" : ""}`}>
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
                className={`filter ${filter === f ? "on" : ""}`}
                data-f={f}
                type="button"
                onClick={() => setFilter(f)}
              >
                {f !== "all" && <i className="dot" />}
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
            onCopy={async (url) => {
              const ok = await copyToClipboard(url);
              flash(ok ? "已复制下载链接" : "复制失败，请手动复制");
            }}
          />
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
      <Modal open={!!confirm} title={confirm?.title || ""} onClose={() => setConfirm(null)}>
        <p>{confirm?.body}</p>
        <div className="modal-acts">
          <Button type="button" onClick={() => setConfirm(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={() => {
              const run = confirm?.run;
              setConfirm(null);
              run?.();
            }}
          >
            {confirm?.ok || "确定"}
          </Button>
        </div>
      </Modal>
      <div className={`page-drop ${pageDrop ? "on" : ""}`}>放开以上传</div>
      {toast ? <div className="toast">{toast}</div> : null}
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

  const create = await fetch(
    `/api/files/mpu?action=create&key=${encodeURIComponent(key)}`,
    { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" } },
  );
  if (!create.ok) {
    const err = (await create.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "mpu create failed");
  }
  const created = (await create.json()) as { uploadId: string };
  const { uploadId } = created;
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
}
