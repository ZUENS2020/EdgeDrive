"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, KeyRound, Link2, MoreHorizontal, RefreshCw, Search, ShieldOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ApiListResponse, ShareDto } from "@/lib/v2-contracts";
import { api, useAdmin } from "./admin-provider";

export function ShareManagerV2() {
  const { t } = useAdmin();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState<ShareDto | null>(null);
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [allowPreview, setAllowPreview] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 260); return () => clearTimeout(timer); }, [query]);
  const shares = useQuery({ queryKey: ["shares", debounced], queryFn: () => api<ApiListResponse<ShareDto>>(`/api/admin/shares${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`) });
  const mutate = async (token: string, body?: Record<string, unknown>, method = "PATCH") => {
    try {
      await api(`/api/admin/shares/${encodeURIComponent(token)}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      setEditing(null); await queryClient.invalidateQueries({ queryKey: ["shares"] }); toast.success(t("共享已更新", "Share updated"));
    } catch (error) { toast.error(error instanceof Error ? error.message : "share-update-failed"); }
  };
  const copy = async (path: string) => { await navigator.clipboard.writeText(new URL(path, location.origin).toString()); toast.success(t("链接已复制", "Link copied")); };
  const startEdit = (share: ShareDto) => { setEditing(share); setPassword(""); setMaxDownloads(share.maxDownloads?.toString() || ""); setExpiresAt(share.expiresAt ? share.expiresAt.slice(0, 16) : ""); setAllowPreview(share.allowPreview); setAllowDownload(share.allowDownload); };
  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">CAPABILITY LINKS</p><h1>{t("共享", "Shares")}</h1><p>{t("每个链接都可撤销、设密、限次并独立控制预览与下载。", "Every link is revocable, password-protected, limited and permission-scoped.")}</p></div></header>
    <section className="catalog-panel">
      <div className="catalog-toolbar"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索文件名或短码", "Search names or codes")} /></label><span className="result-count">{shares.data?.meta.total || 0} {t("条共享", "shares")}</span><button className="icon-button" onClick={() => void shares.refetch()}><RefreshCw size={16} /></button></div>
      <div className="share-table"><div className="share-row share-head"><span>{t("内容", "Content")}</span><span>{t("权限", "Permissions")}</span><span>{t("使用", "Usage")}</span><span>{t("状态", "Status")}</span><span /></div>
        {shares.isLoading ? <div className="empty-state"><RefreshCw className="spin" size={20} />{t("正在读取共享", "Reading shares")}</div> : !(shares.data?.data.length) ? <div className="empty-state"><Link2 size={24} /><strong>{t("还没有共享链接", "No share links")}</strong><span>{t("在文件页选择文件后创建共享。", "Select files in the catalog to create one.")}</span></div> : shares.data.data.map((share) => <div className="share-row" key={share.token}>
          <div><strong>{share.label}</strong><small className="mono">{share.kind === "batch" ? `${share.fileIds.length} files` : share.token.slice(0, 12)}</small></div>
          <div className="permission-badges">{share.allowPreview ? <span>PREVIEW</span> : null}{share.allowDownload ? <span>DOWNLOAD</span> : null}{share.hasPassword ? <span><KeyRound size={11} /> KEY</span> : null}</div>
          <div><strong>{share.downloadCount}{share.maxDownloads ? ` / ${share.maxDownloads}` : ""}</strong><small>{share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : t("永久", "Permanent")}</small></div>
          <div><span className={`status-pill ${share.status}`}>{share.status.toUpperCase()}</span></div>
          <div className="row-actions"><button onClick={() => void copy(share.previewUrl)} aria-label="Copy preview"><Copy size={16} /></button><a href={share.previewUrl} target="_blank" aria-label="Open preview"><ExternalLink size={16} /></a><button onClick={() => startEdit(share)} aria-label="Edit"><MoreHorizontal size={17} /></button></div>
        </div>)}</div>
    </section>
    {editing ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="dialog-panel" role="dialog" aria-modal="true"><header><div><p className="eyebrow">SHARE POLICY</p><h2>{editing.label}</h2></div><button className="icon-button" aria-label={t("关闭", "Close")} onClick={() => setEditing(null)}>×</button></header>
      <div className="field-grid"><label className="field"><span>{t("新密码（留空不修改）", "New password (empty keeps current)")}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="field"><span>{t("每个文件最大下载次数", "Max downloads per file")}</span><input type="number" min="1" value={maxDownloads} onChange={(event) => setMaxDownloads(event.target.value)} /></label><label className="field span-two"><span>{t("到期时间", "Expiry")}</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><fieldset className="permission-controls span-two"><legend>{t("链接能力", "Link capabilities")}</legend><label><input type="checkbox" checked={allowPreview} onChange={(event) => setAllowPreview(event.target.checked)} />{t("允许预览", "Allow preview")}</label><label><input type="checkbox" checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} />{t("允许下载", "Allow download")}</label></fieldset></div>
      <div className="share-links"><button onClick={() => void copy(editing.previewUrl)}><Copy size={15} />{t("复制预览链接", "Copy preview link")}</button><button onClick={() => void copy(editing.downloadUrl)}><Copy size={15} />{t("复制下载链接", "Copy download link")}</button></div>
      <footer className="split-footer"><div><button className="button danger-outline" onClick={() => void mutate(editing.token, { revoked: !editing.revoked })}><ShieldOff size={15} />{editing.revoked ? t("重新启用", "Reactivate") : t("撤销", "Revoke")}</button><button className="button danger-outline" onClick={() => { if (window.confirm(t("确定永久删除这条共享？", "Permanently delete this share?"))) void mutate(editing.token, undefined, "DELETE"); }}><Trash2 size={15} />{t("删除", "Delete")}</button></div><button className="button primary" disabled={!allowPreview && !allowDownload} onClick={() => void mutate(editing.token, { ...(password ? { password } : {}), maxDownloads: maxDownloads ? Number(maxDownloads) : null, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, allowPreview, allowDownload })}>{t("保存", "Save")}</button></footer>
    </section></div> : null}
  </div>;
}
