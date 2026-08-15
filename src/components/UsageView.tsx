"use client";

import { useEffect, useState } from "react";
import { formatSize } from "@/lib/format";
import type { UsagePayload, UsageRange } from "@/lib/usage-types";
import { cn } from "@/lib/utils";

const RANGES: { id: UsageRange; label: string }[] = [
  { id: "24h", label: "24 小时" },
  { id: "7d", label: "7 天" },
  { id: "month", label: "本月" },
];

const R2_FREE = {
  bytes: 10 * 1024 * 1024 * 1024,
  classA: 1_000_000,
  classB: 10_000_000,
};
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

export function UsageView() {
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
    <>
      <div className="header" style={{ padding: "0 0 16px" }}>
        <h1>统计</h1>
        <div className="header-sp" />
        <div className="filters" style={{ border: 0, padding: 0 }}>
          {RANGES.map((item) => (
            <button
              key={item.id}
              className={cn("filter", range === item.id && "on")}
              type="button"
              onClick={() => setRange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p className="usage-lead">
        R2 容量与 Class A/B、D1 读写、Worker 调用量来自 Cloudflare GraphQL Analytics。账号 ID 与 Token 在
        Worker Secrets 里选填。本盘文件数始终从 D1 读取。免费额度条仅作对照，账单以账号套餐为准。
      </p>
      {loading && !data ? <p className="load-hint">正在加载用量…</p> : null}
      {error ? <p className="err">{error}</p> : null}
      {data ? <UsageBody data={data} /> : null}
    </>
  );
}

function UsageBody({ data }: { data: UsagePayload }) {
  const a = data.analytics;
  const r2Bytes = a.r2?.payloadBytes ?? data.disk.catalogBytes;
  const d1Bytes = a.d1?.databaseBytes ?? data.disk.sqliteBytes;
  const showQuota = data.range === "month";

  return (
    <div className="usage-page">
      {!a.configured ? (
        <p className="usage-banner">
          <code>CLOUDFLARE_ACCOUNT_ID</code> 与 <code>CLOUDFLARE_API_TOKEN</code>{" "}
          是 Worker 选填 Secret（Dashboard → 该 Worker → Settings → Variables and Secrets）。不配也能看本盘；配上并具备
          Account Analytics 读权限后，才会显示 R2 Class A/B、D1 查询量与 Worker 调用。
        </p>
      ) : null}
      {a.configured && a.error ? <p className="err">{a.error}</p> : null}
      <div className="usage-grid">
      <section className="usage-card">
        <h2>本盘</h2>
        <p className="hint">D1 里登记的文件与文件夹，不等于账单存储（以 R2 实测为准）。</p>
        <div className="usage-metrics">
          <Metric k="文件" v={n(data.disk.files)} />
          <Metric k="文件夹" v={n(data.disk.folders)} />
          <Metric k="目录合计" v={formatSize(data.disk.catalogBytes)} />
          <Metric k="下载次数" v={n(data.disk.downloads)} />
          <Metric k="即将过期" v={n(data.disk.soon)} warn={data.disk.soon > 0} />
          <Metric k="已过期" v={n(data.disk.expired)} bad={data.disk.expired > 0} />
        </div>
        {data.disk.tables.length > 0 ? (
          <table className="usage-table">
            <thead>
              <tr>
                <th>D1 表</th>
                <th>行数</th>
              </tr>
            </thead>
            <tbody>
              {data.disk.tables.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>{n(t.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="usage-card">
        <h2>R2</h2>
        <p className="hint">对象容量、Class A（写/列举）与 Class B（读/Head）。删除类操作为免费。</p>
        <div className="usage-metrics">
          <Metric k="对象容量" v={r2Bytes != null ? formatSize(r2Bytes) : "—"} />
          <Metric k="对象数" v={n(a.r2?.objectCount ?? data.disk.files)} />
          <Metric k="元数据" v={a.r2?.metadataBytes != null ? formatSize(a.r2.metadataBytes) : "—"} />
          <Metric k="未完成分片" v={n(a.r2?.uploadCount)} />
          <Metric k="Class A" v={n(a.r2?.classA)} />
          <Metric k="Class B" v={n(a.r2?.classB)} />
          <Metric k="免费操作" v={n(a.r2?.freeOps)} />
          <Metric k="其它" v={n(a.r2?.otherOps)} />
        </div>
        {showQuota && a.r2 ? (
          <div className="usage-quotas">
            <Quota label="容量 / 10 GB 免费档" used={r2Bytes || 0} max={R2_FREE.bytes} format={formatSize} />
            <Quota label="Class A / 100 万" used={a.r2.classA} max={R2_FREE.classA} />
            <Quota label="Class B / 1000 万" used={a.r2.classB} max={R2_FREE.classB} />
          </div>
        ) : null}
        {a.r2 && a.r2.byAction.length > 0 ? (
          <table className="usage-table">
            <thead>
              <tr>
                <th>操作</th>
                <th>类别</th>
                <th>次数</th>
              </tr>
            </thead>
            <tbody>
              {a.r2.byAction.slice(0, 12).map((row) => (
                <tr key={row.action}>
                  <td>{row.action}</td>
                  <td>{row.klass === "A" ? "A" : row.klass === "B" ? "B" : row.klass === "free" ? "免费" : "其它"}</td>
                  <td>{n(row.requests)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="usage-card">
        <h2>D1</h2>
        <p className="hint">查询次数、扫描/写入行数、库体积。行数是计费口径，不是结果行数。</p>
        <div className="usage-metrics">
          <Metric k="库体积" v={d1Bytes != null ? formatSize(d1Bytes) : "—"} />
          <Metric k="读查询" v={n(a.d1?.readQueries)} />
          <Metric k="写查询" v={n(a.d1?.writeQueries)} />
          <Metric k="扫描行" v={n(a.d1?.rowsRead)} />
          <Metric k="写入行" v={n(a.d1?.rowsWritten)} />
          <Metric k="响应体" v={a.d1 ? formatSize(a.d1.responseBytes) : "—"} />
          <Metric k="查询耗时合计" v={a.d1 ? `${n(a.d1.queryTimeMs)} ms` : "—"} />
        </div>
        {showQuota && d1Bytes != null ? (
          <div className="usage-quotas">
            <Quota label="存储 / 5 GB 免费档" used={d1Bytes} max={D1_FREE_BYTES} format={formatSize} />
          </div>
        ) : null}
      </section>

      <section className="usage-card">
        <h2>Worker</h2>
        <p className="hint">调用次数、错误、子请求，以及 CPU 分位（微秒换算为毫秒）。</p>
        <div className="usage-metrics">
          <Metric k="请求" v={n(a.worker?.requests)} />
          <Metric k="错误" v={n(a.worker?.errors)} bad={(a.worker?.errors || 0) > 0} />
          <Metric k="子请求" v={n(a.worker?.subrequests)} />
          <Metric k="CPU p50" v={cpuMs(a.worker?.cpuTimeP50Us)} />
          <Metric k="CPU p99" v={cpuMs(a.worker?.cpuTimeP99Us)} />
        </div>
        {a.worker && a.worker.byStatus.length > 0 ? (
          <table className="usage-table">
            <thead>
              <tr>
                <th>调用状态</th>
                <th>请求</th>
                <th>错误</th>
              </tr>
            </thead>
            <tbody>
              {a.worker.byStatus.map((row) => (
                <tr key={row.status}>
                  <td>{statusLabel(row.status)}</td>
                  <td>{n(row.requests)}</td>
                  <td>{n(row.errors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
      </div>
    </div>
  );
}

function Metric({
  k,
  v,
  warn,
  bad,
}: {
  k: string;
  v: string;
  warn?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="usage-metric">
      <span className="k">{k}</span>
      <span className={cn("v", warn && "warn", bad && "bad")}>{v}</span>
    </div>
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
    <div className="usage-quota">
      <div className="usage-quota-meta">
        <span>{label}</span>
        <span>
          {show(used)} / {show(max)}
        </span>
      </div>
      <div className="usage-quota-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
