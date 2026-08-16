"use client";

import { useOne, useNotification } from "@refinedev/core";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/types";
import {
  THEMES,
  getTheme,
  isHex,
  parseCustomColors,
  serializeCustomColors,
  STOCK_BRAND_COLOR,
  type CustomColors,
} from "@/lib/themes";
import { useAppearance } from "./AdminProviders";

type Section = "look" | "files" | "account";

function Swatch({ colors }: { colors: string[] }) {
  return (
    <Box sx={{ display: "flex", height: 44, borderRadius: 1, overflow: "hidden", mb: 1.5 }}>
      {colors.map((c, i) => (
        <Box key={`${c}-${i}`} sx={{ flex: 1, bgcolor: c }} />
      ))}
    </Box>
  );
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const shown = isHex(value) ? value : fallback;
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <input
        type="color"
        aria-label={label}
        value={shown}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 32, padding: 0, border: "1px solid currentColor", borderRadius: 6, cursor: "pointer" }}
      />
      <TextField label={label} value={shown} onChange={(e) => onChange(e.target.value)} size="small" />
    </Stack>
  );
}

export function SettingsView({ initial }: { initial: SiteSettings }) {
  const { open: notify } = useNotification();
  const { setAppearance } = useAppearance();
  const [section, setSection] = useState<Section>("look");
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [purging, setPurging] = useState(false);
  const [cfApiToken, setCfApiToken] = useState("");
  const query = useOne<SiteSettings>({ resource: "settings", id: "site", queryOptions: { retry: false } });

  useEffect(() => {
    if (query.result) setForm({ ...initial, ...query.result });
  }, [query.result, initial]);

  function preview(next: Pick<SiteSettings, "theme_name" | "brand_color" | "custom_colors">) {
    setAppearance({
      theme_name: next.theme_name,
      brand_color: next.brand_color,
      custom_colors: next.custom_colors,
    });
  }

  async function save(extra: Record<string, unknown> = {}, snapshot?: SiteSettings) {
    setPending(true);
    const src = snapshot ?? form;
    const { access_enabled, cron_secret, cf_access_team, cf_access_aud, cf_api_token_set, cf_api_token_from_env, ...rest } =
      src;
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
    preview(data.settings);
    setCfApiToken("");
    notify?.({ type: "success", message: "已保存" });
  }

  async function pickTheme(id: string) {
    const next = { ...form, theme_name: getTheme(id).id };
    setForm(next);
    preview(next);
    await save({ theme_name: next.theme_name }, next);
  }

  function patchCustom(partial: CustomColors) {
    const current = parseCustomColors(form.custom_colors);
    const merged: CustomColors = { ...current };
    for (const key of ["primary", "background", "text"] as const) {
      if (key in partial) {
        const value = partial[key];
        if (isHex(value)) merged[key] = value;
        else delete merged[key];
      }
    }
    const next = { ...form, custom_colors: serializeCustomColors(merged) };
    setForm(next);
    preview(next);
  }

  async function clearCustom() {
    const next = { ...form, custom_colors: "" };
    setForm(next);
    preview(next);
    await save({ custom_colors: "" }, next);
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

  const custom = parseCustomColors(form.custom_colors);
  const activeTheme = getTheme(form.theme_name);
  const selectedId = activeTheme.id;

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
        <Stack spacing={3}>
          <Box>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
              主题
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              选择一套内置主题，立即换肤，无需刷新。自定义颜色会叠在主题之上。
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                gap: 1.5,
              }}
            >
              {THEMES.map((theme) => {
                const on = theme.id === selectedId;
                const p = theme.palette;
                return (
                  <Card
                    key={theme.id}
                    variant="outlined"
                    sx={{
                      borderColor: on ? p.primary.main : "divider",
                      borderWidth: on ? 2 : 1,
                      bgcolor: "background.paper",
                    }}
                  >
                    <CardActionArea onClick={() => void pickTheme(theme.id)} sx={{ height: "100%" }}>
                      <CardContent sx={{ p: 1.75 }}>
                        <Swatch colors={[p.primary.main, p.secondary.main, p.background.paper, p.background.default]} />
                        <Typography fontWeight={700}>{theme.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, lineHeight: 1.5 }}>
                          {theme.description}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>
          </Box>

          <Box>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
              自定义主色
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              覆盖当前主题的主色（优先级低于下方「自定义颜色」）。出厂色 {STOCK_BRAND_COLOR} 不覆盖主题自带主色。
            </Typography>
            <ColorField
              label="标记颜色"
              value={form.brand_color}
              fallback={STOCK_BRAND_COLOR}
              onChange={(hex) => {
                const next = { ...form, brand_color: hex };
                setForm(next);
                if (isHex(hex)) preview(next);
              }}
            />
          </Box>

          <Accordion
            disableGutters
            elevation={0}
            sx={{ border: 1, borderColor: "divider", borderRadius: 1, "&:before": { display: "none" } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box>
                <Typography fontWeight={600}>自定义颜色</Typography>
                <Typography variant="caption" color="text.secondary">
                  主色 / 背景 / 文字，覆盖主题定义。清空即恢复主题默认。
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <ColorField
                  label="主色"
                  value={custom.primary || ""}
                  fallback={activeTheme.palette.primary.main}
                  onChange={(hex) => {
                    if (isHex(hex)) patchCustom({ primary: hex });
                  }}
                />
                <ColorField
                  label="背景色"
                  value={custom.background || ""}
                  fallback={activeTheme.palette.background.default}
                  onChange={(hex) => {
                    if (isHex(hex)) patchCustom({ background: hex });
                  }}
                />
                <ColorField
                  label="文字色"
                  value={custom.text || ""}
                  fallback={activeTheme.palette.text.primary}
                  onChange={(hex) => {
                    if (isHex(hex)) patchCustom({ text: hex });
                  }}
                />
                <Button variant="outlined" disabled={pending || !form.custom_colors} onClick={() => void clearCustom()} sx={{ alignSelf: "flex-start" }}>
                  清空自定义
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Button variant="contained" disabled={pending} onClick={() => void save()} sx={{ alignSelf: "flex-start" }}>
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
