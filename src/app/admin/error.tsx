"use client";

import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Stack sx={{ minHeight: "60vh" }} alignItems="center" justifyContent="center" p={3}>
      <Paper sx={{ p: 4, maxWidth: 480 }}>
        <Typography variant="h2" sx={{ mb: 1 }}>
          管理页渲染失败
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          页面出错了，请重试。若持续出现，请查看 Worker 日志。
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => reset()}>
            重试
          </Button>
          <Button href="/admin">强制刷新</Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
