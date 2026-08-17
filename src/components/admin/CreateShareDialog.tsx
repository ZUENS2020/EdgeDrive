"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useNotification } from "@refinedev/core";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { parseExpireInput } from "@/lib/expires";
import { formatTime } from "@/lib/format";
import { tApiError } from "@/lib/i18n";
import {
  buildShareCreateBody,
  shareAccessValid,
  type ShareExpireMode,
} from "@/lib/share-create";
import type { ShareCopySource } from "@/lib/share-copy";
import { MAX_BATCH_IDS } from "@/lib/types";
import { ShareCopyPanel } from "./ShareCopyPanel";
import { useI18n } from "./I18nProvider";

export type ShareCreateValues = {
  allowDownload: boolean;
  allowPreview: boolean;
  password: string;
  maxDownloads: string;
  expireMode: ShareExpireMode;
  expireN: string;
  expireUnit: "hours" | "days";
  expireUntil: string;
  short: boolean;
};

export const DEFAULT_SHARE_CREATE: ShareCreateValues = {
  allowDownload: true,
  allowPreview: true,
  password: "",
  maxDownloads: "",
  expireMode: "none",
  expireN: "24",
  expireUnit: "hours",
  expireUntil: "",
  short: false,
};

export function ShareAccessSwitches({
  allowDownload,
  allowPreview,
  onChange,
}: {
  allowDownload: boolean;
  allowPreview: boolean;
  onChange: (next: { allowDownload: boolean; allowPreview: boolean }) => void;
}) {
  const { t } = useI18n();
  const accessOk = shareAccessValid(allowDownload, allowPreview);
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      <FormControlLabel
        control={
          <Switch
            checked={allowDownload}
            onChange={(_, checked) => onChange({ allowDownload: checked, allowPreview })}
          />
        }
        label={t("sharePage.allowDownload")}
      />
      <FormControlLabel
        control={
          <Switch
            checked={allowPreview}
            onChange={(_, checked) => onChange({ allowDownload, allowPreview: checked })}
          />
        }
        label={t("sharePage.allowPreview")}
      />
      {accessOk ? null : <FormHelperText error>{t("sharePage.needAccess")}</FormHelperText>}
    </Stack>
  );
}

export function ShareCreateFields({
  values,
  onChange,
  showShort,
}: {
  values: ShareCreateValues;
  onChange: (next: ShareCreateValues) => void;
  showShort?: boolean;
}) {
  const { t } = useI18n();
  const expirePreview = useMemo(() => {
    if (values.expireMode === "none") return t("sharePage.expireNone");
    if (values.expireMode === "perm") return t("expire.previewPerm");
    if (values.expireMode === "until") {
      const parsed = parseExpireInput({
        expires: values.expireUntil ? new Date(values.expireUntil).toISOString() : undefined,
      });
      if (parsed.value) return t("expire.previewUntil", { time: formatTime(parsed.value) });
      return t("expire.pickUntil");
    }
    const num = Number(values.expireN);
    const parsed = parseExpireInput(values.expireUnit === "days" ? { days: num } : { hours: num });
    if (parsed.value) return t("expire.previewAt", { time: formatTime(parsed.value) });
    if (parsed.error?.includes("too large")) return t("expire.tooLarge");
    if (parsed.error) return t("expire.mustPositive");
    return "";
  }, [t, values.expireMode, values.expireN, values.expireUnit, values.expireUntil]);

  return (
    <>
      <ShareAccessSwitches
        allowDownload={values.allowDownload}
        allowPreview={values.allowPreview}
        onChange={(next) => onChange({ ...values, ...next })}
      />
      <TextField
        fullWidth
        margin="dense"
        type="password"
        label={t("sharePage.passwordLabel")}
        helperText={t("sharePage.passwordOptional")}
        value={values.password}
        onChange={(e) => onChange({ ...values, password: e.target.value })}
      />
      <TextField
        fullWidth
        margin="dense"
        type="number"
        label={t("sharePage.maxDownloads")}
        helperText={t("sharePage.maxOptional")}
        value={values.maxDownloads}
        onChange={(e) => onChange({ ...values, maxDownloads: e.target.value })}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        {t("sharePage.colExpires")}
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={values.expireMode}
        onChange={(_, v: ShareExpireMode | null) => v && onChange({ ...values, expireMode: v })}
        sx={{ my: 1 }}
      >
        <ToggleButton value="none">{t("sharePage.expireNone")}</ToggleButton>
        <ToggleButton value="dur">{t("expire.duration")}</ToggleButton>
        <ToggleButton value="until">{t("expire.until")}</ToggleButton>
        <ToggleButton value="perm">{t("expire.permanent")}</ToggleButton>
      </ToggleButtonGroup>
      {values.expireMode === "dur" ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField
            type="number"
            value={values.expireN}
            onChange={(e) => onChange({ ...values, expireN: e.target.value })}
            label={t("expire.amount")}
            fullWidth
          />
          <ToggleButtonGroup
            exclusive
            value={values.expireUnit}
            onChange={(_, v: "hours" | "days" | null) => v && onChange({ ...values, expireUnit: v })}
          >
            <ToggleButton value="hours">{t("expire.hours")}</ToggleButton>
            <ToggleButton value="days">{t("expire.days")}</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      ) : null}
      {values.expireMode === "until" ? (
        <TextField
          type="datetime-local"
          value={values.expireUntil}
          onChange={(e) => onChange({ ...values, expireUntil: e.target.value })}
          fullWidth
          sx={{ mt: 1 }}
        />
      ) : null}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {expirePreview}
      </Typography>
      {showShort ? (
        <FormControlLabel
          control={
            <Switch checked={values.short} onChange={(_, v) => onChange({ ...values, short: v })} />
          }
          label={t("sharePage.makeShort")}
          sx={{ mt: 1 }}
        />
      ) : null}
    </>
  );
}

export function CreateShareDialog({
  open,
  onClose,
  ids,
  names,
  showShort,
  children,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  ids: string[];
  names?: string[];
  showShort?: boolean;
  children?: ReactNode;
  onSuccess?: () => void;
}) {
  const { t, locale } = useI18n();
  const { open: notify } = useNotification();
  const [values, setValues] = useState<ShareCreateValues>(DEFAULT_SHARE_CREATE);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ShareCopySource | null>(null);

  useEffect(() => {
    if (open) {
      setValues(DEFAULT_SHARE_CREATE);
      setBusy(false);
      setCreated(null);
    }
  }, [open]);

  const summary =
    ids.length === 1 ? names?.[0] || ids[0] : t("sharePage.nFiles", { count: ids.length });

  async function submit() {
    if (busy) return;
    if (ids.length > MAX_BATCH_IDS) {
      notify?.({ type: "error", message: t("fileManager.batchTooMany", { max: MAX_BATCH_IDS }) });
      return;
    }
    const built = buildShareCreateBody({
      ids,
      allowDownload: values.allowDownload,
      allowPreview: values.allowPreview,
      password: values.password,
      maxDownloads: values.maxDownloads,
      expireMode: values.expireMode,
      expireN: values.expireN,
      expireUnit: values.expireUnit,
      expireUntil: values.expireUntil,
      short: showShort ? values.short : false,
    });
    if (!built.ok) {
      const key =
        built.error === "need-access"
          ? "sharePage.needAccess"
          : built.error === "need-ids"
            ? "sharePage.noFile"
            : built.error === "invalid-max"
              ? "sharePage.failed"
              : "expire.invalid";
      notify?.({ type: "error", message: t(key) });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
        viewUrl?: string | null;
        downloadUrl?: string;
        allowDownload?: boolean;
        allowPreview?: boolean;
      };
      if (!res.ok || !(data.downloadUrl || data.url)) {
        notify?.({
          type: "error",
          message: tApiError(locale, data.error, "fileManager.shareFailed"),
        });
        return;
      }
      setCreated({
        downloadUrl: data.downloadUrl || data.url || "",
        viewUrl: data.viewUrl ?? null,
        allowDownload: data.allowDownload ?? values.allowDownload,
        allowPreview: data.allowPreview ?? values.allowPreview,
      });
      notify?.({ type: "success", message: t("sharePage.created") });
      onSuccess?.();
    } catch {
      notify?.({ type: "error", message: t("fileManager.shareFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{created ? t("sharePage.created") : t("fileManager.newShare")}</DialogTitle>
      <DialogContent>
        {created ? (
          <>
            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
              {summary}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("sharePage.createdHint")}
            </Typography>
            <ShareCopyPanel source={created} />
          </>
        ) : (
          <>
            {children}
            <Typography variant="body2" sx={{ mt: children ? 1.5 : 0.5, fontWeight: 600 }}>
              {summary}
            </Typography>
            <ShareCreateFields values={values} onChange={setValues} showShort={showShort} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        {created ? (
          <Button variant="contained" onClick={onClose}>
            {t("sharePage.done")}
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>{t("common.cancel")}</Button>
            <Button
              variant="contained"
              disabled={busy || !shareAccessValid(values.allowDownload, values.allowPreview) || !ids.length}
              onClick={() => void submit()}
            >
              {t("sharePage.createSubmit")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
