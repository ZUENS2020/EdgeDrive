"use client";

import { useOne, useNotification } from "@refinedev/core";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/types";

type Section = "look" | "files" | "account";

export function SettingsView({ initial }: { initial: SiteSettings }) {
  const { open: notify } = useNotification();
  const [section, setSection] = useState<Section>("look");
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [purging, setPurging] = useState(false);
  const [cfApiToken, setCfApiToken] = useState("");
  const query = useOne<SiteSettings>({ resource: "settings", id: "site", queryOptions: { retry: false } });

  useEffect(() => {
    if (query.result) setForm({ ...initial, ...query.result });
  }, [query.result, initial]);

  async function save(extra: Record<string, unknown> = {}) {
    setPending(true);
    // 剥离受保护字段（后端拒绝 access_enabled/auth_mode/cron_secret 明文——防篡改）
    const { access_enabled, cron_secret, cf_access_team, cf_access_aud, cf_api_token_set, cf_api_token_from_env, ...rest } = form;
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...rest,
        ...(cfApiToken.trim() ? { cf_api_token: cfApiToken.trim() } : {}),
        ...extra,
      }),
    });
    setPending(false);
    if (!res.ok) {
      notify?.({ type: "error", message: "保存失败" });
      return;
    }
    const data = (await res.json()) as { settings: SiteSettings };
    setForm(data.settings);
    setCfApiToken("");
    notify?.({ type: "success", message: "已保存" });
  }

  async function onPurge() {
    setPurging(true);
    const res = await fetch("/api/cron/purge", { method: "POST" });
    setPurging(false);
    if (!res.ok) {
      notify?.({ type: "error", message: "清理失败" });
      return;
    }
    const data = (await res.json()) as { deleted?: number };
    notify?.({ type: "success", message: `已删除 ${data.deleted ?? 0} 个过期文件` });
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 880 }}>
      <Typography variant="h1" sx={{ mb: 2 }}>
        设置
      </Typography>
      <Tabs value={section} onChange={(_, v) => setSection(v)} sx={{ mb: 3 }}>
        <Tab value="look" label="外观" />
        <Tab value="files" label="文件" />
        <Tab value="account" label="账号" />
      </Tabs>

      {section === "look" ? (
        <Stack spacing={2}>
          <Typography color="text.secondary">产品名固定为 EdgeDrive，这里只改标记颜色。</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <input
              type="color"
              aria-label="标记颜色"
              value={form.brand_color}
              onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
            />
            <TextField
              label="颜色"
              value={form.brand_color}
              onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
            />
          </Stack>
          <Button variant="contained" disabled={pending} onClick={() => void save()}>
            {pending ? "保存中…" : "保存外观"}
          </Button>
        </Stack>
      ) : null}

      {section === "files" ? (
        <Stack spacing={2}>
          <TextField
            type="number"
            label="每页条数"
            value={form.page_size}
            onChange={(e) => setForm({ ...form, page_size: Number(e.target.value) })}
          />
          <TextField
            select
            label="默认有效期"
            value={form.default_expires}
            onChange={(e) => setForm({ ...form, default_expires: e.target.value })}
          >
            <MenuItem value="permanent">永久</MenuItem>
            <MenuItem value="24h">24 小时</MenuItem>
            <MenuItem value="7d">7 天</MenuItem>
            <MenuItem value="30d">30 天</MenuItem>
          </TextField>
          <TextField
            type="number"
            label="过期后保留天数"
            value={form.purge_after_days}
            onChange={(e) => setForm({ ...form, purge_after_days: Number(e.target.value) })}
            helperText="到期后链接先 410。过了保留天数，才允许从 R2 删掉对象。"
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={pending} onClick={() => void save()}>
              {pending ? "保存中…" : "保存文件设置"}
            </Button>
            <Button variant="outlined" disabled={purging} onClick={() => void onPurge()}>
              {purging ? "清理中…" : "立即清理过期文件"}
            </Button>
          </Stack>
        </Stack>
      ) : null}

      {section === "account" ? (
        <Stack spacing={3}>
          <Box>
            <Typography variant="h2" sx={{ mb: 1 }}>
              Access 配置
            </Typography>
            <Alert severity="success" sx={{ mb: 2 }}>
              Cloudflare Access 已启用。管理请求一律验证 Access JWT。未认证请求会被拒绝。
            </Alert>
            <Stack spacing={2}>
              <TextField label="Access Team" value={form.cf_access_team} InputProps={{ readOnly: true }} />
              <TextField label="Application AUD" value={form.cf_access_aud} InputProps={{ readOnly: true }} />
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h2" sx={{ mb: 1 }}>
              Cloudflare 用量（可选）
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Token 两种模式：① 在此填入，存 D1；② Worker Secret CF_API_TOKEN（优先于 D1）。
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Account ID"
                value={form.cf_account_id}
                onChange={(e) => setForm({ ...form, cf_account_id: e.target.value })}
              />
              <TextField
                type="password"
                label={
                  form.cf_api_token_from_env
                    ? "API Token（Worker Secret）"
                    : form.cf_api_token_set
                      ? "API Token（已保存，留空则保持）"
                      : "API Token"
                }
                value={cfApiToken}
                onChange={(e) => setCfApiToken(e.target.value)}
              />
              {form.cf_api_token_set && !form.cf_api_token_from_env ? (
                <Button variant="outlined" disabled={pending} onClick={() => void save({ cf_api_token: "" })}>
                  清除 Token
                </Button>
              ) : null}
              <TextField
                label="Worker 名（过滤，可选）"
                value={form.cf_worker_name}
                onChange={(e) => setForm({ ...form, cf_worker_name: e.target.value })}
              />
              <TextField
                label="R2 桶名（过滤，可选）"
                value={form.cf_r2_bucket}
                onChange={(e) => setForm({ ...form, cf_r2_bucket: e.target.value })}
              />
              <TextField
                label="D1 数据库 ID（过滤，可选）"
                value={form.cf_d1_database_id}
                onChange={(e) => setForm({ ...form, cf_d1_database_id: e.target.value })}
              />
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h2" sx={{ mb: 1 }}>
              定时清理
            </Typography>
            <TextField
              label="CRON 令牌"
              value={form.cron_secret_set ? "已设置（可更换）" : "未设置（保存后自动生成）"}
              InputProps={{ readOnly: true }}
              fullWidth
            />
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={pending} onClick={() => void save()}>
              {pending ? "保存中…" : "保存账号设置"}
            </Button>
            <Button variant="outlined" disabled={pending} onClick={() => void save({ rotate_cron_secret: true })}>
              更换定时令牌
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Box>
  );
}
