"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { parseExpireInput } from "@/lib/expires";
import { formatTime } from "@/lib/format";
import { useI18n } from "./I18nProvider";

export type ExpireSubmit =
  | { action: "permanent" }
  | { action: "expireNow" }
  | { action: "expire"; hours?: number; days?: number; expires?: string };

export function ExpireDialog({
  open,
  count,
  onClose,
  onSubmit,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
  onSubmit: (payload: ExpireSubmit) => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"dur" | "until" | "perm">("dur");
  const [n, setN] = useState("24");
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const [until, setUntil] = useState("");

  const preview = useMemo(() => {
    if (mode === "perm") return t("expire.previewPerm");
    if (mode === "until") {
      const parsed = parseExpireInput({ expires: until ? new Date(until).toISOString() : undefined });
      if (parsed.value) return t("expire.previewUntil", { time: formatTime(parsed.value) });
      return t("expire.pickUntil");
    }
    const num = Number(n);
    const parsed = parseExpireInput(unit === "days" ? { days: num } : { hours: num });
    if (parsed.value) return t("expire.previewAt", { time: formatTime(parsed.value) });
    if (parsed.error?.includes("too large")) return t("expire.tooLarge");
    if (parsed.error) return t("expire.mustPositive");
    return "";
  }, [mode, n, t, unit, until]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{count > 1 ? t("expire.titleN", { count }) : t("expire.title")}</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          sx={{ my: 1 }}
        >
          <ToggleButton value="dur">{t("expire.duration")}</ToggleButton>
          <ToggleButton value="until">{t("expire.until")}</ToggleButton>
          <ToggleButton value="perm">{t("expire.permanent")}</ToggleButton>
        </ToggleButtonGroup>
        {mode === "dur" ? (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <TextField type="number" value={n} onChange={(e) => setN(e.target.value)} label={t("expire.amount")} fullWidth />
            <ToggleButtonGroup exclusive value={unit} onChange={(_, v) => v && setUnit(v)}>
              <ToggleButton value="hours">{t("expire.hours")}</ToggleButton>
              <ToggleButton value="days">{t("expire.days")}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        ) : null}
        {mode === "until" ? (
          <TextField
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {preview}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
        <Button color="warning" onClick={() => onSubmit({ action: "expireNow" })}>
          {t("expire.expireNow")}
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (mode === "perm") return onSubmit({ action: "permanent" });
              if (mode === "until") {
                if (!until) return;
                return onSubmit({ action: "expire", expires: new Date(until).toISOString() });
              }
              const num = Number(n);
              if (!Number.isFinite(num) || num <= 0) return;
              onSubmit(unit === "days" ? { action: "expire", days: num } : { action: "expire", hours: num });
            }}
          >
            {t("common.save")}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
