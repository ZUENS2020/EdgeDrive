"use client";

import CloudIcon from "@mui/icons-material/Cloud";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import { useI18n } from "./I18nProvider";

export function SetupGuide({ tokenRequired }: { tokenRequired: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [team, setTeam] = useState("");
  const [aud, setAud] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team,
        aud,
        ...(tokenRequired ? { setup_token: token } : {}),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        data.error === "bad-setup-token"
          ? t("setup.badToken")
          : data.error?.startsWith("access-needs-team-aud")
            ? t("setup.needTeamAud")
            : data.error === "access-already-enabled"
              ? t("setup.alreadyEnabled")
              : t("setup.enableFailed"),
      );
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", p: 2 }}>
      <Paper sx={{ width: "100%", maxWidth: 520, p: 4 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
            }}
          >
            {PRODUCT_SHORT}
          </Box>
          <Box>
            <Typography fontWeight={700}>{PRODUCT_NAME}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("setup.subtitle")}
            </Typography>
          </Box>
        </Stack>
        <Alert severity="info" icon={<CloudIcon />} sx={{ mb: 2 }}>
          {t("setup.alert")}
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("setup.step1")}
          <br />
          {t("setup.step2")}
          <br />
          {t("setup.step3")}
        </Typography>
        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Access Team"
              placeholder={t("setup.teamPlaceholder")}
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Application AUD"
              placeholder="AUD Token"
              value={aud}
              onChange={(e) => setAud(e.target.value)}
              required
              fullWidth
            />
            {tokenRequired ? (
              <TextField
                label="SETUP_TOKEN"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                fullWidth
              />
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Button type="submit" variant="contained" disabled={pending} size="large">
              {pending ? t("setup.enabling") : t("setup.enable")}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
