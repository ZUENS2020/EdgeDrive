"use client";

import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useI18n } from "@/components/admin/I18nProvider";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <Stack sx={{ minHeight: "60vh" }} alignItems="center" justifyContent="center" p={3}>
      <Paper sx={{ p: 4, maxWidth: 480 }}>
        <Typography variant="h2" sx={{ mb: 1 }}>
          {t("error.title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("error.body")}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => reset()}>
            {t("common.retry")}
          </Button>
          <Button href="/admin">{t("error.forceRefresh")}</Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
