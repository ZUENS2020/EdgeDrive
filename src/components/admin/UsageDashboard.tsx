"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { UsageBarChart } from "@/components/UsageChart";
import { formatSize } from "@/lib/format";
import { topBars } from "@/lib/usage-charts";
import type { UsagePayload, UsageRange } from "@/lib/usage-types";

const RANGES: { id: UsageRange; label: string }[] = [
  { id: "24h", label: "24 小时" },
  { id: "7d", label: "7 天" },
  { id: "month", label: "本月" },
];
const R2_FREE = { bytes: 10 * 1024 * 1024 * 1024, classA: 1_000_000, classB: 10_000_000 };
const D1_FREE_BYTES = 5 * 1024 * 1024 * 1024;

function n(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}
function cpuMs(us: number | null | undefined): string {
  if (us == null || !Number.isFinite(us)) return "—";
  return `${(us / 1000).toFixed(2)} ms`;
}
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    success: "成功",
    clientDisconnected: "客户端断开",
    scriptThrewException: "脚本异常",
    exceededResources: "超出资源",
    internalError: "内部错误",
    exceededCpu: "超出 CPU",
    exceededMemory: "超出内存",
  };
  return map[status] || status;
}

export function UsageDashboard() {
  const [range, setRange] = useState<UsageRange>("month");
  const [data, setData] = useState<UsagePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/usage?range=${range}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "未登录" : "加载失败");
        return (await res.json()) as UsagePayload;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(String((err as Error).message || err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Typography variant="h1" sx={{ flex: 1 }}>
          统计
        </Typography>
        <ToggleButtonGroup exclusive size="small" value={range} onChange={(_, v) => v && setRange(v)}>
          {RANGES.map((item) => (
            <ToggleButton key={item.id} value={item.id}>
              {item.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        R2 容量与 Class A/B、D1 读写、Worker 调用量来自 Cloudflare GraphQL Analytics。账号 ID 与 Token 在设置 → 账号里选填。
      </Typography>
      {loading && !data ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {data ? <UsageBody data={data} /> : null}
    </Box>
  );
}

function UsageBody({ data }: { data: UsagePayload }) {
  const a = data.analytics;
  const r2Bytes = a.r2?.payloadBytes ?? data.disk.catalogBytes;
  const d1Bytes = a.d1?.databaseBytes ?? data.disk.sqliteBytes;
  const showQuota = data.range === "month";
  const siteBars = topBars([
    { label: "文件", value: data.disk.files },
    { label: "文件夹", value: data.disk.folders },
    { label: "下载", value: data.disk.downloads },
    { label: "即将过期", value: data.disk.soon },
    { label: "已过期", value: data.disk.expired },
  ]);
  const r2Bars = topBars((a.r2?.byAction || []).map((row) => ({ label: row.action, value: row.requests })));
  const d1Bars = topBars([
    { label: "读查询", value: a.d1?.readQueries ?? 0 },
    { label: "写查询", value: a.d1?.writeQueries ?? 0 },
    { label: "扫描行", value: a.d1?.rowsRead ?? 0 },
    { label: "写入行", value: a.d1?.rowsWritten ?? 0 },
  ]);
  const workerBars = topBars(
    (a.worker?.byStatus || []).map((row) => ({ label: statusLabel(row.status), value: row.requests })),
  );

  return (
    <Stack spacing={2}>
      {!a.configured ? (
        <Alert severity="info">账号 ID 与 API Token 在设置 → 账号里选填。不配也能看本站文件数。</Alert>
      ) : null}
      {a.configured && a.error ? <Alert severity="error">{a.error}</Alert> : null}
      <Grid container spacing={2}>
        <Hero k="文件" v={n(data.disk.files)} />
        <Hero k="容量" v={r2Bytes != null ? formatSize(r2Bytes) : "—"} />
        <Hero k="下载总数" v={n(data.disk.downloads)} />
        <Hero k="Worker 请求" v={n(a.worker?.requests)} />
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} sx={{ minWidth: 0 }}>
          <Card variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
            <CardContent>
              <Typography variant="h2">本站</Typography>
              <MetricGrid
                items={[
                  ["文件", n(data.disk.files)],
                  ["文件夹", n(data.disk.folders)],
                  ["目录合计", formatSize(data.disk.catalogBytes)],
                  ["下载次数", n(data.disk.downloads)],
                  ["即将过期", n(data.disk.soon)],
                  ["已过期", n(data.disk.expired)],
                ]}
              />
              <UsageBarChart items={siteBars} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} sx={{ minWidth: 0 }}>
          <Card variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
            <CardContent>
              <Typography variant="h2">R2</Typography>
              <MetricGrid
                items={[
                  ["对象容量", r2Bytes != null ? formatSize(r2Bytes) : "—"],
                  ["对象数", n(a.r2?.objectCount ?? data.disk.files)],
                  ["Class A", n(a.r2?.classA)],
                  ["Class B", n(a.r2?.classB)],
                ]}
              />
              {showQuota && a.r2 ? (
                <Quota label="容量 / 10 GB" used={r2Bytes || 0} max={R2_FREE.bytes} format={formatSize} />
              ) : null}
              <UsageBarChart items={r2Bars} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} sx={{ minWidth: 0 }}>
          <Card variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
            <CardContent>
              <Typography variant="h2">D1</Typography>
              <MetricGrid
                items={[
                  ["库体积", d1Bytes != null ? formatSize(d1Bytes) : "—"],
                  ["读查询", n(a.d1?.readQueries)],
                  ["写查询", n(a.d1?.writeQueries)],
                  ["扫描行", n(a.d1?.rowsRead)],
                ]}
              />
              {showQuota && d1Bytes != null ? (
                <Quota label="存储 / 5 GB" used={d1Bytes} max={D1_FREE_BYTES} format={formatSize} />
              ) : null}
              <UsageBarChart items={d1Bars} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} sx={{ minWidth: 0 }}>
          <Card variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
            <CardContent>
              <Typography variant="h2">Worker</Typography>
              <MetricGrid
                items={[
                  ["请求", n(a.worker?.requests)],
                  ["错误", n(a.worker?.errors)],
                  ["CPU p50", cpuMs(a.worker?.cpuTimeP50Us)],
                  ["CPU p99", cpuMs(a.worker?.cpuTimeP99Us)],
                ]}
              />
              <UsageBarChart items={workerBars} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}

function Hero({ k, v }: { k: string; v: string }) {
  return (
    <Grid item xs={6} md={3}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            {k}
          </Typography>
          <Typography variant="h2">{v}</Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

function MetricGrid({ items }: { items: [string, string][] }) {
  return (
    <Grid container spacing={1} sx={{ my: 1 }}>
      {items.map(([k, v]) => (
        <Grid item xs={6} key={k} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {k}
          </Typography>
          <Typography fontWeight={600}>{v}</Typography>
        </Grid>
      ))}
    </Grid>
  );
}

function Quota({
  label,
  used,
  max,
  format,
}: {
  label: string;
  used: number;
  max: number;
  format?: (n: number) => string;
}) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const show = format || n;
  return (
    <Box sx={{ my: 1 }}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption">{label}</Typography>
        <Typography variant="caption">
          {show(used)} / {show(max)}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} />
    </Box>
  );
}
