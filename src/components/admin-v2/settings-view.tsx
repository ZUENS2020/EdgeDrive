"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Languages, LockKeyhole, RefreshCw, RotateCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppLocale, AppSettingsDto, ThemeId } from "@/lib/v2-contracts";
import { api, useAdmin } from "./admin-provider";

const themeOptions: { id: ThemeId; label: string; detail: string }[] = [
  { id: "onyx", label: "Onyx", detail: "Graphite / steel" },
  { id: "porcelain", label: "Porcelain", detail: "Paper / ink" },
  { id: "nocturne", label: "Nocturne", detail: "Midnight / copper" },
];

export function SettingsViewV2() {
  const context = useAdmin();
  const { t } = context;
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<{ data: AppSettingsDto }>("/api/admin/settings") });
  const current = settings.data?.data;
  const [pageSize, setPageSize] = useState("50");
  const [expiredRetention, setExpiredRetention] = useState("7");
  const [trashRetention, setTrashRetention] = useState("30");
  const [defaultExpires, setDefaultExpires] = useState("24h");
  useEffect(() => { if (current) { setPageSize(String(current.pageSize)); setExpiredRetention(String(current.expiredRetentionDays)); setTrashRetention(String(current.trashRetentionDays)); setDefaultExpires(current.defaultExpires); } }, [current]);
  const patch = async (body: Record<string, unknown>) => {
    try {
      const response = await api<{ data: AppSettingsDto }>("/api/admin/settings", { method: "PATCH", body: JSON.stringify(body) });
      queryClient.setQueryData(["settings"], response);
      if (body.themeName) context.setTheme(body.themeName as ThemeId);
      if (body.language) context.setLocale(body.language as AppLocale);
      toast.success(t("设置已保存", "Settings saved"));
    } catch (error) { toast.error(error instanceof Error ? error.message : "settings-failed"); }
  };
  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">SYSTEM POLICY</p><h1>{t("设置", "Settings")}</h1><p>{t("外观、目录默认值与自动清理策略。", "Appearance, catalog defaults and automated retention policy.")}</p></div></header>
    <section className="settings-section"><div className="section-heading"><div><h2>{t("主题", "Theme")}</h2><p>{t("三种低饱和、无渐变的工作界面。", "Three restrained, gradient-free workspaces.")}</p></div></div><div className="theme-grid">{themeOptions.map((option) => <button key={option.id} data-preview={option.id} className={`theme-card ${context.theme === option.id ? "is-active" : ""}`} onClick={() => void patch({ themeName: option.id })}><span className="theme-preview"><i /><i /><i /></span><span><strong>{option.label}</strong><small>{option.detail}</small></span>{context.theme === option.id ? <Check size={17} /> : null}</button>)}</div></section>
    <section className="settings-section"><div className="section-heading"><div><h2>{t("语言与目录", "Language & catalog")}</h2><p>{t("控制默认页面大小和新共享的生命周期。", "Control catalog paging and default lifecycle.")}</p></div><Languages size={18} /></div><div className="settings-form"><label className="field"><span>{t("界面语言", "Interface language")}</span><select value={context.locale} onChange={(event) => void patch({ language: event.target.value })}><option value="zh">简体中文</option><option value="en">English</option></select></label><label className="field"><span>{t("每页条目", "Page size")}</span><select value={pageSize} onChange={(event) => setPageSize(event.target.value)}><option>25</option><option>50</option><option>100</option></select></label><label className="field"><span>{t("默认到期", "Default expiry")}</span><select value={defaultExpires} onChange={(event) => setDefaultExpires(event.target.value)}><option value="permanent">{t("永久", "Permanent")}</option><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option></select></label><button className="button primary align-end" onClick={() => void patch({ pageSize: Number(pageSize), defaultExpires })}>{t("保存目录设置", "Save catalog settings")}</button></div></section>
    <section className="settings-section"><div className="section-heading"><div><h2>{t("保留策略", "Retention")}</h2><p>{t("定时任务按这些宽限期清理元数据和对象。", "Scheduled cleanup uses these grace periods.")}</p></div><RefreshCw size={18} /></div><div className="settings-form"><label className="field"><span>{t("过期文件保留天数", "Expired file grace days")}</span><input type="number" min="0" max="3650" value={expiredRetention} onChange={(event) => setExpiredRetention(event.target.value)} /></label><label className="field"><span>{t("回收站保留天数", "Trash retention days")}</span><input type="number" min="1" max="3650" value={trashRetention} onChange={(event) => setTrashRetention(event.target.value)} /></label><button className="button primary align-end" onClick={() => void patch({ expiredRetentionDays: Number(expiredRetention), trashRetentionDays: Number(trashRetention) })}>{t("保存保留策略", "Save retention")}</button><button className="button secondary align-end" onClick={() => void patch({ rotateCronSecret: true })}><RotateCw size={15} />{t("轮换定时密钥", "Rotate cron key")}</button></div></section>
    <section className="settings-section security-section"><div className="section-heading"><div><h2>Cloudflare Access</h2><p>{t("启用后采用故障关闭策略；身份配置不可由普通管理请求改写。", "Fail-closed once enabled; identity configuration is immutable from normal admin requests.")}</p></div>{current?.accessEnabled ? <ShieldCheck size={19} /> : <LockKeyhole size={19} />}</div><div className="security-readout"><span>{current?.accessEnabled ? t("已启用", "Enabled") : t("待设置", "Setup required")}</span>{current?.cfAccessTeam ? <code>{current.cfAccessTeam}</code> : null}{current?.cfAccessAud ? <code>{current.cfAccessAud}</code> : null}</div></section>
  </div>;
}
