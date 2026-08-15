"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applyBrandColor } from "@/lib/brand";
import type { SiteSettings } from "@/lib/types";
import { Button } from "./ui/Button";
import { Field, Input, Select, Textarea } from "./ui/Input";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    applyBrandColor(form.brand_color);
  }, [form.brand_color]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setSaved("保存失败");
      return;
    }
    const data = (await res.json()) as { settings: SiteSettings };
    setForm(data.settings);
    applyBrandColor(data.settings.brand_color);
    setSaved("已保存，界面已应用");
    router.refresh();
  }

  return (
    <form className="settings-page" onSubmit={onSubmit}>
      <Field label="站点名">
        <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
      </Field>
      <Field label="站点描述">
        <Textarea
          value={form.site_description}
          onChange={(e) => setForm({ ...form, site_description: e.target.value })}
        />
      </Field>
      <Field label="主色（应用到 --brand / --accent）">
        <div className="color-row">
          <input
            type="color"
            aria-label="主色选择"
            value={form.brand_color}
            onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
          />
          <Input
            type="text"
            value={form.brand_color}
            onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
          />
        </div>
      </Field>
      <Field label="每页条数">
        <Input
          type="number"
          min={1}
          max={200}
          value={form.page_size}
          onChange={(e) => setForm({ ...form, page_size: Number(e.target.value) })}
        />
      </Field>
      <Field label="默认有效期">
        <Select
          value={form.default_expires}
          onChange={(e) => setForm({ ...form, default_expires: e.target.value })}
        >
          <option value="permanent">永久</option>
          <option value="24h">24 小时</option>
          <option value="7d">7 天</option>
          <option value="30d">30 天</option>
        </Select>
      </Field>
      <div className="modal-acts" style={{ justifyContent: "flex-start" }}>
        <Button variant="primary" type="submit">
          保存设置
        </Button>
        {saved ? <span style={{ color: "var(--text-3)", fontSize: 12 }}>{saved}</span> : null}
      </div>
    </form>
  );
}
