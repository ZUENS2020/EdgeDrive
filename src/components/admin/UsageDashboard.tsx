"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { UsageBarChart } from "@/components/UsageChart";
import { formatSize } from "@/lib/format";
import { numberLocale, tUsageStatus, type Locale, type MessageKey } from "@/lib/i18n";
import { topBars } from "@/lib/usage-charts";
import type { UsagePayload, UsageRange } from "@/lib/usage-types";
import { useI18n, type Translate } from "./I18nProvider";

const R2_FREE = { bytes: 10 * 1024 * 1024 * 1024, classA: 1_000_000, classB: 10_000_000 };
const D1_FREE_BYTES = 5 * 1024 * 1024 * 1024;

function n(value: number | null | undefined, locale: Locale): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(numberLocale(locale)).format(Math.round(value));
}
function cpuMs(us: number | null | undefined): string {
  if (us == null || !Number.isFinite(us)) return "—";
  return `${(us / 1000).toFixed(2)} ms`;
}

export function UsageDashboard() {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<UsageRange>("month");
  const [data, setData] = useState<UsagePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const ranges: { id: UsageRange; label: MessageKey }[] = [
    { id: "24h", label: "usage.range24h" },
    { id: "7d", label: "usage.range7d" },
    { id: "month", label: "usage.rangeMonth" },
  ];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/usage?range=${range}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? t("usage.needLogin") : t("usage.loadFailed"));
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
  }, [range, t]);

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: 0,
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Typography variant="h1" sx={{ flex: 1 }}>
          {t("usage.title")}
        </Typography>
        <ToggleButtonGroup exclusive size="small" value={range} onChange={(_, v) => v && setRange(v)}>
          {ranges.map((item) => (
            <ToggleButton key={item.id} value={item.id}>
              {t(item.label)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {t("usage.intro")}
      </Typography>
      {loading && !data ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {data ? <UsageBody data={data} t={t} locale={locale} /> : null}
    </Box>
  );
}

function UsageBody({ data, t, locale }: { data: UsagePayload; t: Translate; locale: Locale }) {
  const a = data.analytics;
  const r2Bytes = a.r2?.payloadBytes ?? data.disk.catalogBytes;
  const d1Bytes = a.d1?.databaseBytes ?? data.disk.sqliteBytes;
  const showQuota = data.range === "month";
  const chartEmpty = t("usage.chartEmpty");
  const chartAria = t("usage.chartAria");
  const siteBars = topBars([
    { label: t("usage.files"), value: data.disk.files },
    { label: t("usage.folders"), value: data.disk.folders },
    { label: t("usage.downloads"), value: data.disk.downloads },
    { label: t("usage.soon"), value: data.disk.soon },
    { label: t("usage.expired"), value: data.disk.expired },
  ]);
  const r2Bars = topBars((a.r2?.byAction || []).map((row) => ({ label: row.action, value: row.requests })));
  const d1Bars = topBars([
    { label: t("usage.d1Read"), value: a.d1?.readQueries ?? 0 },
    { label: t("usage.d1Write"), value: a.d1?.writeQueries ?? 0 },
    { label: t("usage.d1RowsRead"), value: a.d1?.rowsRead ?? 0 },
    { label: t("usage.d1RowsWritten"), value: a.d1?.rowsWritten ?? 0 },
  ]);
  const workerBars = topBars(
    (a.worker?.byStatus || []).map((row) => ({ label: tUsageStatus(locale, row.status), value: row.requests })),
  );

  return (
    <Stack spacing={2}>
      {!a.configured ? <Alert severity="info">{t("usage.notConfigured")}</Alert> : null}
      {a.configured && a.error ? <Alert severity="error">{a.error}</Alert> : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
          gap: 2,
          width: "100%",
        }}
      >
        <Hero k={t("usage.heroFiles")} v={n(data.disk.files, locale)} />
        <Hero k={t("usage.heroCapacity")} v={r2Bytes != null ? formatSize(r2Bytes) : "—"} />
        <Hero k={t("usage.heroDownloads")} v={n(data.disk.downloads, locale)} />
        <Hero k={t("usage.heroWorker")} v={n(a.worker?.requests, locale)} />
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
          width: "100%",
        }}
      >
        <Card variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
          <CardContent>
            <Typography variant="h2">{t("usage.site")}</Typography>
            <MetricGrid
              items={[
                [t("usage.files"), n(data.disk.files, locale)],
                [t("usage.folders"), n(data.disk.folders, locale)],
                [t("usage.catalog"), formatSize(data.disk.catalogBytes)],
                [t("usage.downloadCount"), n(data.disk.downloads, locale)],
                [t("usage.soon"), n(data.disk.soon, locale)],
                [t("usage.expired"), n(data.disk.expired, locale)],
              ]}
            />
            <UsageBarChart items={siteBars} locale={locale} emptyLabel={chartEmpty} ariaLabel={chartAria} />
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
          <CardContent>
            <Typography variant="h2">R2</Typography>
            <MetricGrid
              items={[
                [t("usage.r2Bytes"), r2Bytes != null ? formatSize(r2Bytes) : "—"],
                [t("usage.r2Objects"), n(a.r2?.objectCount ?? data.disk.files, locale)],
                ["Class A", n(a.r2?.classA, locale)],
                ["Class B", n(a.r2?.classB, locale)],
              ]}
            />
            {showQuota && a.r2 ? (
              <Quota label={t("usage.quotaR2")} used={r2Bytes || 0} max={R2_FREE.bytes} format={formatSize} locale={locale} />
            ) : null}
            <UsageBarChart items={r2Bars} locale={locale} emptyLabel={chartEmpty} ariaLabel={chartAria} />
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
          <CardContent>
            <Typography variant="h2">D1</Typography>
            <MetricGrid
              items={[
                [t("usage.d1Size"), d1Bytes != null ? formatSize(d1Bytes) : "—"],
                [t("usage.d1Read"), n(a.d1?.readQueries, locale)],
                [t("usage.d1Write"), n(a.d1?.writeQueries, locale)],
                [t("usage.d1RowsRead"), n(a.d1?.rowsRead, locale)],
              ]}
            />
            {showQuota && d1Bytes != null ? (
              <Quota label={t("usage.quotaD1")} used={d1Bytes} max={D1_FREE_BYTES} format={formatSize} locale={locale} />
            ) : null}
            <UsageBarChart items={d1Bars} locale={locale} emptyLabel={chartEmpty} ariaLabel={chartAria} />
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
          <CardContent>
            <Typography variant="h2">Worker</Typography>
            <MetricGrid
              items={[
                [t("usage.workerReq"), n(a.worker?.requests, locale)],
                [t("usage.workerErr"), n(a.worker?.errors, locale)],
                [t("usage.cpuP50"), cpuMs(a.worker?.cpuTimeP50Us)],
                [t("usage.cpuP99"), cpuMs(a.worker?.cpuTimeP99Us)],
              ]}
            />
            <UsageBarChart items={workerBars} locale={locale} emptyLabel={chartEmpty} ariaLabel={chartAria} />
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}

function Hero({ k, v }: { k: string; v: string }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 0, width: "100%" }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {k}
        </Typography>
        <Typography variant="h2">{v}</Typography>
      </CardContent>
    </Card>
  );
}

function MetricGrid({ items }: { items: [string, string][] }) {
  return (
    <Box
      sx={{
        my: 1,
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 1,
        width: "100%",
      }}
    >
      {items.map(([k, v]) => (
        <Box key={k} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {k}
          </Typography>
          <Typography fontWeight={600}>{v}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function Quota({
  label,
  used,
  max,
  format,
  locale,
}: {
  label: string;
  used: number;
  max: number;
  format?: (n: number) => string;
  locale: Locale;
}) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const show = format || ((value: number) => n(value, locale));
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
