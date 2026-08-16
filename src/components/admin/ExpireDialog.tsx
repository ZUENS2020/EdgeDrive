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
  const [mode, setMode] = useState<"dur" | "until" | "perm">("dur");
  const [n, setN] = useState("24");
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const [until, setUntil] = useState("");

  const preview = useMemo(() => {
    if (mode === "perm") return "永久（expires = null）";
    if (mode === "until") {
      const parsed = parseExpireInput({ expires: until ? new Date(until).toISOString() : undefined });
      return parsed.value ? `截止 ${formatTime(parsed.value)}` : "请选择截止时间";
    }
    const num = Number(n);
    const parsed = parseExpireInput(unit === "days" ? { days: num } : { hours: num });
    return parsed.value ? `到期 ${formatTime(parsed.value)}` : parsed.error || "";
  }, [mode, n, unit, until]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{count > 1 ? `设置有效期（${count} 个文件）` : "设置有效期"}</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          sx={{ my: 1 }}
        >
          <ToggleButton value="dur">持续时长</ToggleButton>
          <ToggleButton value="until">截止时间</ToggleButton>
          <ToggleButton value="perm">永久</ToggleButton>
        </ToggleButtonGroup>
        {mode === "dur" ? (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <TextField type="number" value={n} onChange={(e) => setN(e.target.value)} label="数量" fullWidth />
            <ToggleButtonGroup exclusive value={unit} onChange={(_, v) => v && setUnit(v)}>
              <ToggleButton value="hours">小时</ToggleButton>
              <ToggleButton value="days">天</ToggleButton>
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
          立即过期
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>取消</Button>
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
            保存
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
