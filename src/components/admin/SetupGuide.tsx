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

export function SetupGuide({ tokenRequired }: { tokenRequired: boolean }) {
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
          ? "SETUP_TOKEN 不对"
          : data.error?.startsWith("access-needs-team-aud")
            ? "请填写 Access Team 和 AUD"
            : data.error === "access-already-enabled"
              ? "Access 已启用，请通过 Cloudflare Access 登录"
              : "启用失败",
      );
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#f6f5f2", p: 2 }}>
      <Paper sx={{ width: "100%", maxWidth: 520, p: 4 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: "#171717",
              color: "#fff",
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
              首次配置 · Cloudflare Access
            </Typography>
          </Box>
        </Stack>
        <Alert severity="info" icon={<CloudIcon />} sx={{ mb: 2 }}>
          部署后请立刻填写 Access Team / AUD 并启用。启用后所有管理请求走 Access JWT，未认证一律拒绝。公开下载{" "}
          <code>/dl/*</code> 不受影响。
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          1. Zero Trust → Access → Applications → Self-hosted，域名填 <code>你的域名/admin*</code>
          <br />
          2. Team 是 <code>https://&lt;team&gt;.cloudflareaccess.com</code> 的前缀
          <br />
          3. AUD 在应用 → 其他设置 → AUD 标签
        </Typography>
        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Access Team"
              placeholder="例如 zuens2020"
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
              {pending ? "启用中…" : "启用 Access"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
