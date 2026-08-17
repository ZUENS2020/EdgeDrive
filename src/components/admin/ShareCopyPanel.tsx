"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useNotification } from "@refinedev/core";
import { copyAbsoluteUrl } from "@/lib/clipboard";
import { shareCopyRows, type ShareCopyKind, type ShareCopySource } from "@/lib/share-copy";
import { originJoin } from "@/lib/share-urls";
import { useI18n } from "./I18nProvider";

function copiedKey(kind: ShareCopyKind): "sharePage.copiedDownload" | "sharePage.copiedPreview" {
  return kind === "download" ? "sharePage.copiedDownload" : "sharePage.copiedPreview";
}

export function ShareCopyPanel({ source }: { source: ShareCopySource }) {
  const { t } = useI18n();
  const { open: notify } = useNotification();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const rows = shareCopyRows(source);

  async function copy(kind: ShareCopyKind, path: string) {
    const ok = await copyAbsoluteUrl(path);
    notify?.({
      type: ok ? "success" : "error",
      message: ok ? t(copiedKey(kind)) : t("common.copyFailed"),
    });
  }

  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      {rows.map((row) => {
        const display = row.path ? originJoin(origin, row.path) : t("common.dash");
        return (
          <Stack key={row.kind} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
            <TextField
              fullWidth
              size="small"
              label={row.kind === "download" ? t("sharePage.downloadLink") : t("sharePage.previewLink")}
              value={display}
              helperText={row.enabled ? undefined : t("sharePage.linkDisabled")}
              disabled={!row.enabled}
              InputProps={{ readOnly: true }}
              sx={{ "& input": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 13 } }}
            />
            <Button
              variant="outlined"
              disabled={!row.enabled}
              onClick={() => void copy(row.kind, row.path)}
              sx={{ mt: { sm: 0.5 }, flexShrink: 0 }}
            >
              {t("sharePage.copy")}
            </Button>
          </Stack>
        );
      })}
    </Stack>
  );
}
