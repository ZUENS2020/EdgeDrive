"use client";

import { useOne, useNotification } from "@refinedev/core";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { parseLocale, tRowAction } from "@/lib/i18n";
import { resolvePurgeConfirm, type PurgeConfirmChoice } from "@/lib/purge-confirm";
import { parseRowActions, ROW_ACTION_IDS, setRowActionEnabled } from "@/lib/row-actions";
import { THEMES, getTheme } from "@/lib/themes";
import { resolveTokenClearConfirm, type TokenClearConfirmChoice } from "@/lib/token-clear-confirm";
import type { SiteSettings } from "@/lib/types";
import { useAppearance, useSiteSettings } from "./AdminProviders";
import { useI18n } from "./I18nProvider";

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

export function SettingsView({ initial }: { initial: SiteSettings }) {
  const { t, locale } = useI18n();
  const { open: notify } = useNotification();
  const { setAppearance } = useAppearance();
  const { setSiteSettings } = useSiteSettings();
  const [section, setSection] = useState<Section>("look");
  const [form, setForm] = useState(() => ({
    ...initial,
    language: parseLocale(initial.language),
    row_actions: parseRowActions(initial.row_actions),
  }));
  const [pending, setPending] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [tokenClearConfirmOpen, setTokenClearConfirmOpen] = useState(false);
  const [cfApiToken, setCfApiToken] = useState("");
  const query = useOne<SiteSettings>({ resource: "settings", id: "site", queryOptions: { retry: false } });

  useEffect(() => {
    if (query.result) {
      setForm({
        ...initial,
        ...query.result,
        language: parseLocale(query.result.language ?? initial.language),
        row_actions: parseRowActions(query.result.row_actions ?? initial.row_actions),
      });
    }
  }, [query.result, initial]);

  function preview(next: Pick<SiteSettings, "theme_name">) {
    setAppearance({ theme_name: next.theme_name });
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
      notify?.({ type: "error", message: t("settings.saveFailed") });
      return;
    }
    const data = (await res.json()) as { settings: SiteSettings };
    setForm(data.settings);
    preview(data.settings);
    setSiteSettings(data.settings);
    setCfApiToken("");
    notify?.({ type: "success", message: t("settings.saved") });
  }

  async function pickTheme(id: string) {
    const next = { ...form, theme_name: getTheme(id).id };
    setForm(next);
    preview(next);
    await save({ theme_name: next.theme_name }, next);
  }

  async function pickLanguage(id: string) {
    const language = parseLocale(id);
    const next = { ...form, language };
    setForm(next);
    setSiteSettings({ language });
    await save({ language }, next);
  }

  async function onPurge() {
    setPurging(true);
    const res = await fetch("/api/cron/purge", { method: "POST" });
    setPurging(false);
    if (!res.ok) {
      notify?.({ type: "error", message: t("settings.purgeFailed") });
      return;
    }
    const data = (await res.json()) as { deleted?: number };
    notify?.({ type: "success", message: t("settings.purged", { count: data.deleted ?? 0 }) });
  }

  function closePurgeConfirm(choice: PurgeConfirmChoice) {
    setPurgeConfirmOpen(false);
    if (resolvePurgeConfirm(choice).run) void onPurge();
  }

  function closeTokenClearConfirm(choice: TokenClearConfirmChoice) {
    setTokenClearConfirmOpen(false);
    if (resolveTokenClearConfirm(choice).run) void save({ cf_api_token: "" });
  }

  const activeTheme = getTheme(form.theme_name);
  const selectedId = activeTheme.id;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 880 }}>
      <Typography variant="h1" sx={{ mb: 2 }}>
        {t("settings.title")}
      </Typography>
      <Tabs value={section} onChange={(_, v) => setSection(v)} sx={{ mb: 3 }}>
        <Tab value="look" label={t("settings.tabLook")} />
        <Tab value="files" label={t("settings.tabFiles")} />
        <Tab value="account" label={t("settings.tabAccount")} />
      </Tabs>

      {section === "look" ? (
        <Stack spacing={3}>
          <Box>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
              {t("settings.language")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.languageHelp")}
            </Typography>
            <TextField
              select
              label={t("settings.language")}
              value={parseLocale(form.language)}
              onChange={(e) => void pickLanguage(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="zh">{t("settings.langZh")}</MenuItem>
              <MenuItem value="en">{t("settings.langEn")}</MenuItem>
            </TextField>
          </Box>
          <Box>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
              {t("settings.theme")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.themeHelp")}
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
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>
          </Box>
        </Stack>
      ) : null}

      {section === "files" ? (
        <Stack spacing={2}>
          <TextField
            type="number"
            label={t("settings.pageSize")}
            value={form.page_size}
            onChange={(e) => setForm({ ...form, page_size: Number(e.target.value) })}
          />
          <TextField
            select
            label={t("settings.defaultExpires")}
            value={form.default_expires}
            onChange={(e) => setForm({ ...form, default_expires: e.target.value })}
          >
            <MenuItem value="permanent">{t("settings.expiresPermanent")}</MenuItem>
            <MenuItem value="24h">{t("settings.expires24h")}</MenuItem>
            <MenuItem value="7d">{t("settings.expires7d")}</MenuItem>
            <MenuItem value="30d">{t("settings.expires30d")}</MenuItem>
          </TextField>
          <TextField
            type="number"
            label={t("settings.purgeAfterDays")}
            value={form.purge_after_days}
            onChange={(e) => setForm({ ...form, purge_after_days: Number(e.target.value) })}
            helperText={t("settings.purgeAfterHelp")}
          />
          <Box>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
              {t("settings.rowActions")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
              {t("settings.rowActionsHelp")}
            </Typography>
            <FormGroup>
              {ROW_ACTION_IDS.map((id) => {
                const enabled = parseRowActions(form.row_actions).includes(id);
                return (
                  <FormControlLabel
                    key={id}
                    control={
                      <Checkbox
                        checked={enabled}
                        onChange={(_, checked) =>
                          setForm({
                            ...form,
                            row_actions: setRowActionEnabled(parseRowActions(form.row_actions), id, checked),
                          })
                        }
                      />
                    }
                    label={tRowAction(locale, id)}
                  />
                );
              })}
            </FormGroup>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={pending} onClick={() => void save()}>
              {pending ? t("common.saving") : t("settings.saveFiles")}
            </Button>
          </Stack>
          <Divider sx={{ mt: 4, mb: 1 }} />
          <Box>
            <Typography variant="h2" color="error" sx={{ mb: 0.5 }}>
              {t("settings.dangerZone")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
              {t("settings.dangerHelp")}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              disabled={purging}
              onClick={() => setPurgeConfirmOpen(true)}
            >
              {purging ? t("settings.purging") : t("settings.purgeNow")}
            </Button>
          </Box>
        </Stack>
      ) : null}

      <Dialog open={purgeConfirmOpen} onClose={() => closePurgeConfirm("cancel")}>
        <DialogTitle>{t("settings.purgeConfirmTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("settings.purgeConfirmMessage")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => closePurgeConfirm("cancel")}>{t("common.cancel")}</Button>
          <Button color="error" variant="contained" onClick={() => closePurgeConfirm("confirm")}>
            {t("common.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tokenClearConfirmOpen} onClose={() => closeTokenClearConfirm("cancel")}>
        <DialogTitle>{t("settings.tokenClearTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("settings.tokenClearMessage")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => closeTokenClearConfirm("cancel")}>{t("common.cancel")}</Button>
          <Button color="error" variant="contained" onClick={() => closeTokenClearConfirm("confirm")}>
            {t("common.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      {section === "account" ? (
        <Stack spacing={3}>
          <Box>
            <Typography variant="h2" sx={{ mb: 1 }}>
              {t("settings.access")}
            </Typography>
            <Alert severity="success" sx={{ mb: 2 }}>
              {t("settings.accessOn")}
            </Alert>
            <Stack spacing={2}>
              <TextField label="Access Team" value={form.cf_access_team} InputProps={{ readOnly: true }} />
              <TextField label="Application AUD" value={form.cf_access_aud} InputProps={{ readOnly: true }} />
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h2" sx={{ mb: 1 }}>
              {t("settings.cfUsage")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.cfUsageHelp")}
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
                    ? t("settings.tokenSecret")
                    : form.cf_api_token_set
                      ? t("settings.tokenSaved")
                      : t("settings.token")
                }
                value={cfApiToken}
                onChange={(e) => setCfApiToken(e.target.value)}
              />
              {form.cf_api_token_set && !form.cf_api_token_from_env ? (
                <Button variant="outlined" disabled={pending} onClick={() => setTokenClearConfirmOpen(true)}>
                  {t("settings.clearToken")}
                </Button>
              ) : null}
              <TextField
                label={t("settings.workerName")}
                value={form.cf_worker_name}
                onChange={(e) => setForm({ ...form, cf_worker_name: e.target.value })}
              />
              <TextField
                label={t("settings.r2Bucket")}
                value={form.cf_r2_bucket}
                onChange={(e) => setForm({ ...form, cf_r2_bucket: e.target.value })}
              />
              <TextField
                label={t("settings.d1Id")}
                value={form.cf_d1_database_id}
                onChange={(e) => setForm({ ...form, cf_d1_database_id: e.target.value })}
              />
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h2" sx={{ mb: 1 }}>
              {t("settings.cron")}
            </Typography>
            <TextField
              label={t("settings.cronToken")}
              value={form.cron_secret_set ? t("settings.cronSet") : t("settings.cronUnset")}
              InputProps={{ readOnly: true }}
              fullWidth
            />
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={pending} onClick={() => void save()}>
              {pending ? t("common.saving") : t("settings.saveAccount")}
            </Button>
            <Button variant="outlined" disabled={pending} onClick={() => void save({ rotate_cron_secret: true })}>
              {t("settings.rotateCron")}
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Box>
  );
}
