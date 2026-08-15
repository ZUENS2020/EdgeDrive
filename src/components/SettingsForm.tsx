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
    toast.success("已保存，界面已应用");
    router.refresh();
  }

  return (
    <form className="settings-page grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="site_name">站点名</Label>
        <Input
          id="site_name"
          value={form.site_name}
          onChange={(e) => setForm({ ...form, site_name: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="site_description">站点描述</Label>
        <Textarea
          id="site_description"
          value={form.site_description}
          onChange={(e) => setForm({ ...form, site_description: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="brand_color">主色（应用到 --brand / --accent）</Label>
        <div className="color-row">
          <input
            type="color"
            aria-label="主色选择"
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
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "保存中…" : "保存设置"}
        </Button>
      </div>
    </form>
  );
}
