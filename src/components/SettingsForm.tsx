"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyBrandColor } from "@/lib/brand";
import type { AuthMode, SiteSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Section = "look" | "files" | "account";

export function SettingsForm({
  initial,
  authMode,
}: {
  initial: SiteSettings;
  authMode: AuthMode;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("look");
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [purging, setPurging] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwPending, setPwPending] = useState(false);
  const [cfApiToken, setCfApiToken] = useState("");

  useEffect(() => {
    applyBrandColor(form.brand_color);
  }, [form.brand_color]);

  async function saveSettings(extra: Record<string, unknown> = {}) {
    setPending(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...(cfApiToken.trim() ? { cf_api_token: cfApiToken.trim() } : {}),
        ...extra,
      }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("保存失败");
      return;
    }
    const data = (await res.json()) as { settings: SiteSettings };
    setForm(data.settings);
    applyBrandColor(data.settings.brand_color);
    setCfApiToken("");
    toast.success("已保存");
    router.refresh();
  }

  async function rotateCron() {
    await saveSettings({ rotate_cron_secret: true });
  }

  async function onPurge() {
    setPurging(true);
    const res = await fetch("/api/cron/purge", { method: "POST" });
    setPurging(false);
    if (!res.ok) {
      toast.error("清理失败");
      return;
    }
    const data = (await res.json()) as { deleted?: number };
    toast.success(`已删除 ${data.deleted ?? 0} 个过期文件`);
    router.refresh();
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwPending(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setPwPending(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(
        err.error === "bad-current" ? "当前密码不对" : err.error === "new-password-min-8" ? "新密码至少 8 位" : "改密失败",
      );
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("密码已更新");
  }

  const nav: { id: Section; label: string; hint: string }[] = [
    { id: "look", label: "外观", hint: "产品名固定为 EdgeDrive，这里只改标记颜色。" },
    { id: "files", label: "文件", hint: "列表分页、新文件默认有效期，以及过期后如何清理。" },
    { id: "account", label: "账号", hint: "管理员密码、登录方式，以及可选的 Cloudflare 用量统计。" },
  ];
  const current = nav.find((item) => item.id === section) ?? nav[0];

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="设置分类">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(section === item.id && "on")}
            aria-current={section === item.id ? "page" : undefined}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="settings-pane">
        <header className="settings-pane-head">
          <h2>{current.label}</h2>
          <p>{current.hint}</p>
        </header>
        {section === "look" ? (
          <>
            <section className="settings-block">
              <h3>标记颜色</h3>
              <p className="hint">用在左上角 ED 标记和公开页点缀。名称、简介和按钮文案不再单独配置。</p>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="brand_color">颜色</Label>
                  <div className="color-row">
                    <input
                      type="color"
                      aria-label="标记颜色"
                      value={form.brand_color}
                      onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                    />
                    <Input
                      id="brand_color"
                      type="text"
                      value={form.brand_color}
                      onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </section>
            <div className="settings-save">
              <Button type="button" disabled={pending} onClick={() => void saveSettings()}>
                {pending ? "保存中…" : "保存外观"}
              </Button>
            </div>
          </>
        ) : null}

        {section === "files" ? (
          <>
            <section className="settings-block">
              <h3>列表与上传</h3>
              <p className="hint">管理台分页，以及新上传文件的默认有效期。</p>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="page_size">每页条数</Label>
                  <Input
                    id="page_size"
                    type="number"
                    min={1}
                    max={200}
                    value={form.page_size}
                    onChange={(e) => setForm({ ...form, page_size: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>默认有效期</Label>
                  <Select
                    value={form.default_expires}
                    onValueChange={(value) => setForm({ ...form, default_expires: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">永久</SelectItem>
                      <SelectItem value="24h">24 小时</SelectItem>
                      <SelectItem value="7d">7 天</SelectItem>
                      <SelectItem value="30d">30 天</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
            <section className="settings-block">
              <h3>过期清理</h3>
              <p className="hint">到期后链接先 410。过了保留天数，才允许从 R2 删掉对象。永久文件不会被清。</p>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="purge_after_days">过期后保留天数</Label>
                  <Input
                    id="purge_after_days"
                    type="number"
                    min={0}
                    max={3650}
                    value={form.purge_after_days}
                    onChange={(e) => setForm({ ...form, purge_after_days: Number(e.target.value) })}
                  />
                </div>
              </div>
            </section>
            <div className="settings-save">
              <Button type="button" disabled={pending} onClick={() => void saveSettings()}>
                {pending ? "保存中…" : "保存文件设置"}
              </Button>
              <Button type="button" variant="outline" disabled={purging} onClick={onPurge}>
                {purging ? "清理中…" : "立即清理过期文件"}
              </Button>
            </div>
          </>
        ) : null}

        {section === "account" ? (
          <>
            <section className="settings-block">
              <h3>登录方式</h3>
              <p className="hint">账密存在本站数据库。Access 模式下后台由 Cloudflare Access 保护，不再显示登录页。</p>
              <div className="grid gap-2">
                <Label>模式</Label>
                <Select
                  value={form.auth_mode}
                  onValueChange={(value) => setForm({ ...form, auth_mode: value as AuthMode })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="password">账密</SelectItem>
                    <SelectItem value="access">Cloudflare Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>
            {authMode === "password" || form.auth_mode === "password" ? (
              <form className="settings-block" onSubmit={onPassword}>
                <h3>登录密码</h3>
                <p className="hint">新密码至少 8 位。</p>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="current_password">当前密码</Label>
                    <Input
                      id="current_password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new_password">新密码</Label>
                    <Input
                      id="new_password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={pwPending}>
                    {pwPending ? "更新中…" : "更新密码"}
                  </Button>
                </div>
              </form>
            ) : (
              <section className="settings-block">
                <h3>Cloudflare Access</h3>
                <p className="hint">当前应用不处理登录。GitHub / Google 等 OAuth 在 Access 里配。</p>
              </section>
            )}
            <section className="settings-block">
              <h3>Cloudflare 用量（可选）</h3>
              <p className="hint">
                用量 Token 两种模式：① 公开 fork 方便部署——在此填入，存 D1；② 更安全——Worker Secret{" "}
                <code>CF_API_TOKEN</code>（优先于 D1）。Account ID 仍在此填写。Token 不会再读出来。
              </p>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cf_account_id">Account ID</Label>
                  <Input
                    id="cf_account_id"
                    value={form.cf_account_id}
                    onChange={(e) => setForm({ ...form, cf_account_id: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cf_api_token">
                    API Token
                    {form.cf_api_token_from_env
                      ? "（Worker Secret CF_API_TOKEN）"
                      : form.cf_api_token_set
                        ? "（已保存，留空则保持）"
                        : ""}
                  </Label>
                  <Input
                    id="cf_api_token"
                    type="password"
                    autoComplete="off"
                    placeholder={form.cf_api_token_set ? "已配置" : ""}
                    value={cfApiToken}
                    onChange={(e) => setCfApiToken(e.target.value)}
                  />
                  {form.cf_api_token_set && !form.cf_api_token_from_env ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => void saveSettings({ cf_api_token: "" })}
                    >
                      清除 Token
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cf_worker_name">Worker 名（过滤，可选）</Label>
                  <Input
                    id="cf_worker_name"
                    value={form.cf_worker_name}
                    onChange={(e) => setForm({ ...form, cf_worker_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cf_r2_bucket">R2 桶名（过滤，可选）</Label>
                  <Input
                    id="cf_r2_bucket"
                    value={form.cf_r2_bucket}
                    onChange={(e) => setForm({ ...form, cf_r2_bucket: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cf_d1_database_id">D1 数据库 ID（过滤，可选）</Label>
                  <Input
                    id="cf_d1_database_id"
                    value={form.cf_d1_database_id}
                    onChange={(e) => setForm({ ...form, cf_d1_database_id: e.target.value })}
                  />
                </div>
              </div>
            </section>
            <section className="settings-block">
              <h3>定时清理</h3>
              <p className="hint">
                Worker 已启用每天 04:00 UTC 的 Cron Trigger，会 GET /api/cron/purge（Bearer 令牌）。外部定时器也可
                GET 或 POST 同一地址。管理台点「立即清理」不用这个令牌。
              </p>
              <div className="grid gap-2">
                <Label htmlFor="cron_secret">CRON 令牌</Label>
                <Input id="cron_secret" readOnly value={form.cron_secret_set ? "已设置（可更换）" : "未设置（保存后自动生成）"} />
              </div>
            </section>
            <div className="settings-save">
              <Button type="button" disabled={pending} onClick={() => void saveSettings()}>
                {pending ? "保存中…" : "保存账号设置"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={rotateCron}>
                更换定时令牌
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
