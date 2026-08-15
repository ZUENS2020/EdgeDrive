"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyBrandColor } from "@/lib/brand";
import type { SiteSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    applyBrandColor(form.brand_color);
  }, [form.brand_color]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("保存失败");
      return;
    }
    const data = (await res.json()) as { settings: SiteSettings };
    setForm(data.settings);
    applyBrandColor(data.settings.brand_color);
    toast.success("已保存");
    router.refresh();
  }

  return (
    <form className="settings-page" onSubmit={onSubmit}>
      <section className="settings-block">
        <h2>站点</h2>
        <p className="hint">浏览器标题、侧栏名称、左上角标记。</p>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="site_name">站点名</Label>
            <Input
              id="site_name"
              maxLength={40}
              value={form.site_name}
              onChange={(e) => setForm({ ...form, site_name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site_description">简介</Label>
            <Textarea
              id="site_description"
              maxLength={200}
              value={form.site_description}
              onChange={(e) => setForm({ ...form, site_description: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="logo_text">标记文字（空则用站点名首字）</Label>
            <Input
              id="logo_text"
              maxLength={2}
              placeholder="例：直"
              value={form.logo_text}
              onChange={(e) => setForm({ ...form, logo_text: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="brand_color">标记颜色</Label>
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

      <section className="settings-block">
        <h2>首页与登录</h2>
        <p className="hint">公开页 `/` 和登录页 `/login` 上的文案。</p>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="home_kicker">首页副标题</Label>
            <Input
              id="home_kicker"
              maxLength={40}
              value={form.home_kicker}
              onChange={(e) => setForm({ ...form, home_kicker: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="home_dl_hint">直链说明</Label>
            <Input
              id="home_dl_hint"
              maxLength={80}
              value={form.home_dl_hint}
              onChange={(e) => setForm({ ...form, home_dl_hint: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="home_cta">首页按钮</Label>
            <Input
              id="home_cta"
              maxLength={24}
              value={form.home_cta}
              onChange={(e) => setForm({ ...form, home_cta: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="footer_note">首页页脚（可空）</Label>
            <Input
              id="footer_note"
              maxLength={200}
              value={form.footer_note}
              onChange={(e) => setForm({ ...form, footer_note: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="login_subtitle">登录页副标题</Label>
            <Input
              id="login_subtitle"
              maxLength={40}
              value={form.login_subtitle}
              onChange={(e) => setForm({ ...form, login_subtitle: e.target.value })}
            />
          </div>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={form.show_admin_link}
              onChange={(e) => setForm({ ...form, show_admin_link: e.target.checked })}
            />
            首页显示进入管理后台的按钮
          </label>
        </div>
      </section>

      <section className="settings-block">
        <h2>管理与上传</h2>
        <p className="hint">侧栏文案、列表分页、新文件默认有效期。</p>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="admin_subtitle">侧栏副标题</Label>
            <Input
              id="admin_subtitle"
              maxLength={20}
              value={form.admin_subtitle}
              onChange={(e) => setForm({ ...form, admin_subtitle: e.target.value })}
            />
          </div>
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

      <Button type="submit" disabled={pending}>
        {pending ? "保存中…" : "保存"}
      </Button>
    </form>
  );
}
