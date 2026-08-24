"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowDownToLine, Database, Files, Folder, HardDrive, Share2, Sparkles } from "lucide-react";
import type { OverviewDto } from "@/lib/v2-contracts";
import { api, useAdmin } from "./admin-provider";

function bytes(value: number): string {
  if (!value) return "0 B";
  const unit = Math.min(4, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** unit).toFixed(unit ? 1 : 0)} ${["B", "KB", "MB", "GB", "TB"][unit]}`;
}

export function OverviewViewV2() {
  const { t } = useAdmin();
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api<{ data: OverviewDto }>("/api/admin/overview") });
  const data = overview.data?.data;
  const cards = [
    [t("文件", "Files"), data?.files || 0, Files], [t("文件夹", "Folders"), data?.folders || 0, Folder],
    [t("下载", "Downloads"), data?.downloads || 0, ArrowDownToLine], [t("活跃共享", "Active shares"), data?.activeShares || 0, Share2],
  ] as const;
  const storageRatio = data?.logicalBytes ? Math.min(100, ((data.physicalBytes || 0) / data.logicalBytes) * 100) : 0;
  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">LOCAL TELEMETRY</p><h1>{t("运行概览", "Operational overview")}</h1><p>{t("不依赖外部分析凭据，仅使用 D1 中的本地元数据。", "Local metadata from D1, with no external analytics credentials.")}</p></div></header>
    <section className="metric-grid">{cards.map(([label, value, Icon]) => <article className="metric-card" key={label}><div><span>{label}</span><strong>{value.toLocaleString()}</strong></div><Icon size={18} /></article>)}</section>
    <section className="overview-grid">
      <article className="overview-panel"><header><div><p className="eyebrow">STORAGE EFFICIENCY</p><h2>{t("对象去重", "Object deduplication")}</h2></div><HardDrive size={19} /></header><div className="storage-readout"><strong>{bytes(data?.physicalBytes || 0)}</strong><span>{t("物理占用", "physical")}</span></div><div className="ratio-track"><i style={{ width: `${storageRatio}%` }} /></div><div className="storage-legend"><span><Database size={14} />{t("逻辑大小", "Logical")} <b>{bytes(data?.logicalBytes || 0)}</b></span><span><Sparkles size={14} />{t("节省", "Saved")} <b>{bytes(data?.savedBytes || 0)}</b></span></div></article>
      <article className="overview-panel"><header><div><p className="eyebrow">LIFECYCLE</p><h2>{t("待处理项目", "Lifecycle queue")}</h2></div><Archive size={19} /></header><div className="lifecycle-list"><div><span>{t("24 小时内过期", "Expiring in 24 hours")}</span><strong>{data?.expiring || 0}</strong></div><div><span>{t("已过期", "Expired")}</span><strong>{data?.expired || 0}</strong></div><div><span>{t("回收站", "Trash")}</span><strong>{data?.trash || 0}</strong></div></div></article>
    </section>
  </div>;
}
