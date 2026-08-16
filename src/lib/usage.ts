import { getKv, KV } from "./app-config";
import { resolveCfApiToken } from "./cf-credentials";
import { getCfEnv, getDB } from "./cloudflare";
import type { UsagePayload, UsageRange } from "./usage-types";

export type { UsagePayload, UsageRange } from "./usage-types";

const CLASS_A = new Set([
  "ListBuckets",
  "PutBucket",
  "ListObjects",
  "PutObject",
  "CopyObject",
  "CompleteMultipartUpload",
  "CreateMultipartUpload",
  "LifecycleStorageTierTransition",
  "ListMultipartUploads",
  "UploadPart",
  "UploadPartCopy",
  "ListParts",
  "PutBucketEncryption",
  "PutBucketCors",
  "PutBucketLifecycleConfiguration",
]);

const CLASS_B = new Set([
  "HeadBucket",
  "HeadObject",
  "GetObject",
  "UsageSummary",
  "GetBucketEncryption",
  "GetBucketLocation",
  "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);

const CLASS_FREE = new Set(["DeleteObject", "DeleteBucket", "AbortMultipartUpload"]);

export function usageWindow(range: UsageRange): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (range === "24h") from.setTime(to.getTime() - 24 * 3600e3);
  else if (range === "7d") from.setTime(to.getTime() - 7 * 24 * 3600e3);
  else {
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
  }
  return { from, to };
}

function klassOf(action: string): "A" | "B" | "free" | "other" {
  if (CLASS_A.has(action)) return "A";
  if (CLASS_B.has(action)) return "B";
  if (CLASS_FREE.has(action)) return "free";
  const lower = action.toLowerCase();
  if (lower.startsWith("get") || lower.startsWith("head")) return "B";
  if (lower.startsWith("put") || lower.startsWith("list") || lower.startsWith("create") || lower.startsWith("upload")) {
    return "A";
  }
  if (lower.startsWith("delete") || lower.startsWith("abort")) return "free";
  return "other";
}

async function localDisk(): Promise<UsagePayload["disk"]> {
  const db = await getDB();
  const nowIso = new Date().toISOString();
  const soonIso = new Date(Date.now() + 24 * 3600e3).toISOString();
  const files = await db
    .prepare(
      `SELECT
         COUNT(*) as n,
         COALESCE(SUM(size), 0) as bytes,
         COALESCE(SUM(download_count), 0) as downloads,
         SUM(CASE WHEN expires IS NOT NULL AND expires < ? THEN 1 ELSE 0 END) as expired,
         SUM(CASE WHEN expires IS NOT NULL AND expires >= ? AND expires < ? THEN 1 ELSE 0 END) as soon
       FROM files`,
    )
    .bind(nowIso, nowIso, soonIso)
    .first<{ n: number; bytes: number; downloads: number; expired: number; soon: number }>();
  const folders = await db.prepare("SELECT COUNT(*) as n FROM folders").first<{ n: number }>();
  const names = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '_cf_%'
         AND name NOT LIKE 'd1_%'
       ORDER BY name`,
    )
    .all<{ name: string }>();
  const tables: { name: string; rows: number }[] = [];
  for (const row of names.results || []) {
    try {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(row.name)) continue;
      const count = await db.prepare(`SELECT COUNT(*) as n FROM "${row.name}"`).first<{ n: number }>();
      tables.push({ name: row.name, rows: count?.n || 0 });
    } catch {
      tables.push({ name: row.name, rows: 0 });
    }
  }
  let sqliteBytes: number | null = null;
  try {
    const size = await db
      .prepare(
        "SELECT (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) as n",
      )
      .first<{ n: number }>();
    if (size && Number.isFinite(Number(size.n))) sqliteBytes = Number(size.n);
  } catch {
    sqliteBytes = null;
  }
  return {
    files: files?.n || 0,
    folders: folders?.n || 0,
    catalogBytes: Number(files?.bytes || 0),
    downloads: Number(files?.downloads || 0),
    expired: Number(files?.expired || 0),
    soon: Number(files?.soon || 0),
    tables,
    sqliteBytes,
  };
}

type ViewerAccounts<T> = { viewer?: { accounts?: T[] } };

type R2Account = {
  r2OperationsAdaptiveGroups?: { sum?: { requests?: number }; dimensions?: { actionType?: string } }[];
  r2StorageAdaptiveGroups?: {
    max?: { objectCount?: number; uploadCount?: number; payloadSize?: number; metadataSize?: number };
  }[];
};

type D1Account = {
  d1AnalyticsAdaptiveGroups?: {
    sum?: { readQueries?: number; writeQueries?: number; rowsRead?: number; rowsWritten?: number };
    avg?: { queryBatchTimeMs?: number };
  }[];
  d1StorageAdaptiveGroups?: { max?: { databaseSizeBytes?: number } }[];
};

type WorkerAccount = {
  workersInvocationsAdaptive?: {
    sum?: { requests?: number; errors?: number; subrequests?: number };
    quantiles?: { cpuTimeP50?: number; cpuTimeP99?: number };
    dimensions?: { status?: string };
  }[];
};

async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json()) as { data?: T; errors?: { message?: string }[] };
    const error = json.errors?.map((e) => e.message).filter(Boolean).join("; ");
    if (!json.data) {
      return { error: error || `GraphQL HTTP ${res.status}` };
    }
    return { data: json.data, error };
  } catch (err) {
    return { error: String((err as Error).message || err) };
  }
}

function firstAccount<T>(data?: ViewerAccounts<T>): T | undefined {
  return data?.viewer?.accounts?.[0];
}

async function fetchR2(
  token: string,
  account: string,
  start: string,
  end: string,
  bucket: string,
): Promise<{ value: UsagePayload["analytics"]["r2"]; error?: string }> {
  const bucketDecl = bucket ? "$bucketName: string" : "";
  const extra = bucket ? "bucketName: $bucketName" : "";
  const result = await graphql<ViewerAccounts<R2Account>>(
    token,
    `query R2Usage($accountTag: string!, $start: Time, $end: Time${bucket ? ", " : ""}${bucketDecl}) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2OperationsAdaptiveGroups(
            limit: 10000
            filter: { datetime_geq: $start, datetime_leq: $end${extra ? `, ${extra}` : ""} }
          ) {
            sum { requests }
            dimensions { actionType }
          }
          r2StorageAdaptiveGroups(
            limit: 1
            filter: { datetime_geq: $start, datetime_leq: $end${extra ? `, ${extra}` : ""} }
            orderBy: [datetime_DESC]
          ) {
            max { objectCount uploadCount payloadSize metadataSize }
            dimensions { datetime }
          }
        }
      }
    }`,
    { accountTag: account, start, end, ...(bucket ? { bucketName: bucket } : {}) },
  );
  const acc = firstAccount(result.data);
  if (!acc) return { value: null, error: result.error || "R2 没有分析数据" };
  const byAction = (acc.r2OperationsAdaptiveGroups || [])
    .map((row) => {
      const action = row.dimensions?.actionType || "unknown";
      const requests = Number(row.sum?.requests || 0);
      return { action, requests, klass: klassOf(action) };
    })
    .filter((row) => row.requests > 0)
    .sort((a, b) => b.requests - a.requests);
  const storage = acc.r2StorageAdaptiveGroups?.[0]?.max;
  return {
    value: {
      payloadBytes: storage?.payloadSize != null ? Number(storage.payloadSize) : null,
      metadataBytes: storage?.metadataSize != null ? Number(storage.metadataSize) : null,
      objectCount: storage?.objectCount != null ? Number(storage.objectCount) : null,
      uploadCount: storage?.uploadCount != null ? Number(storage.uploadCount) : null,
      classA: byAction.filter((r) => r.klass === "A").reduce((n, r) => n + r.requests, 0),
      classB: byAction.filter((r) => r.klass === "B").reduce((n, r) => n + r.requests, 0),
      freeOps: byAction.filter((r) => r.klass === "free").reduce((n, r) => n + r.requests, 0),
      otherOps: byAction.filter((r) => r.klass === "other").reduce((n, r) => n + r.requests, 0),
      byAction,
    },
    error: result.error,
  };
}

async function fetchD1(
  token: string,
  account: string,
  start: string,
  end: string,
  startDate: string,
  endDate: string,
  databaseId: string,
): Promise<{ value: UsagePayload["analytics"]["d1"]; error?: string }> {
  const idFilter = databaseId ? ", databaseId: $databaseId" : "";
  const idDecl = databaseId ? ", $databaseId: string" : "";
  const andFilter: Record<string, string> = {
    datetimeHour_geq: start,
    datetimeHour_leq: end,
  };
  if (databaseId) andFilter.databaseId = databaseId;
  const result = await graphql<ViewerAccounts<D1Account>>(
    token,
    `query D1Usage($accountTag: string!, $filter: ZoneWorkersRequestsFilter_InputObject, $startDate: Date, $endDate: Date${idDecl}) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(limit: 10000, filter: $filter) {
            sum { readQueries writeQueries rowsRead rowsWritten }
            avg { queryBatchTimeMs }
            dimensions { datetimeHour }
          }
          d1StorageAdaptiveGroups(
            limit: 1
            filter: { date_geq: $startDate, date_leq: $endDate${idFilter} }
            orderBy: [date_DESC]
          ) {
            max { databaseSizeBytes }
            dimensions { date }
          }
        }
      }
    }`,
    {
      accountTag: account,
      filter: { AND: [andFilter] },
      startDate,
      endDate,
      ...(databaseId ? { databaseId } : {}),
    },
  );
  const acc = firstAccount(result.data);
  if (!acc) return { value: null, error: result.error || "D1 没有分析数据" };
  let readQueries = 0;
  let writeQueries = 0;
  let rowsRead = 0;
  let rowsWritten = 0;
  let timeWeighted = 0;
  let timeWeight = 0;
  for (const row of acc.d1AnalyticsAdaptiveGroups || []) {
    const reads = Number(row.sum?.readQueries || 0);
    const writes = Number(row.sum?.writeQueries || 0);
    readQueries += reads;
    writeQueries += writes;
    rowsRead += Number(row.sum?.rowsRead || 0);
    rowsWritten += Number(row.sum?.rowsWritten || 0);
    const avg = Number(row.avg?.queryBatchTimeMs || 0);
    const weight = reads + writes;
    if (weight > 0) {
      timeWeighted += avg * weight;
      timeWeight += weight;
    }
  }
  const d1Size = acc.d1StorageAdaptiveGroups?.[0]?.max?.databaseSizeBytes;
  return {
    value: {
      readQueries,
      writeQueries,
      rowsRead,
      rowsWritten,
      responseBytes: 0,
      queryTimeMs: timeWeight ? timeWeighted / timeWeight : 0,
      databaseBytes: d1Size != null ? Number(d1Size) : null,
    },
    error: result.error,
  };
}

async function fetchWorker(
  token: string,
  account: string,
  start: string,
  end: string,
  workerName: string,
): Promise<{ value: UsagePayload["analytics"]["worker"]; error?: string }> {
  const nameDecl = workerName ? ", $scriptName: string" : "";
  const nameFilter = workerName ? ", scriptName: $scriptName" : "";
  const result = await graphql<ViewerAccounts<WorkerAccount>>(
    token,
    `query WorkerUsage($accountTag: string, $start: string, $end: string${nameDecl}) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 10000
            filter: { datetime_geq: $start, datetime_leq: $end${nameFilter} }
          ) {
            sum { requests errors subrequests }
            quantiles { cpuTimeP50 cpuTimeP99 }
            dimensions { datetimeHour status }
          }
        }
      }
    }`,
    { accountTag: account, start, end, ...(workerName ? { scriptName: workerName } : {}) },
  );
  const acc = firstAccount(result.data);
  if (!acc) return { value: null, error: result.error || "Worker 没有分析数据" };
  const statusMap = new Map<string, { requests: number; errors: number }>();
  let requests = 0;
  let errors = 0;
  let subrequests = 0;
  const cpuSamples: { cpuTimeP50?: number; cpuTimeP99?: number }[] = [];
  for (const row of acc.workersInvocationsAdaptive || []) {
    const status = row.dimensions?.status || "unknown";
    const req = Number(row.sum?.requests || 0);
    const err = Number(row.sum?.errors || 0);
    requests += req;
    errors += err;
    subrequests += Number(row.sum?.subrequests || 0);
    const cur = statusMap.get(status) || { requests: 0, errors: 0 };
    cur.requests += req;
    cur.errors += err;
    statusMap.set(status, cur);
    if (row.quantiles) cpuSamples.push(row.quantiles);
  }
  return {
    value: {
      requests,
      errors,
      subrequests,
      cpuTimeP50Us: cpuSamples.length ? Number(cpuSamples[0]?.cpuTimeP50 ?? null) : null,
      cpuTimeP99Us: cpuSamples.length
        ? Math.max(...cpuSamples.map((s) => Number(s?.cpuTimeP99 || 0)))
        : null,
      byStatus: [...statusMap.entries()].map(([status, row]) => ({ status, ...row })),
    },
    error: result.error,
  };
}

async function graphqlAnalytics(range: UsageRange): Promise<UsagePayload["analytics"]> {
  const db = await getDB();
  let envBag: Record<string, unknown> | undefined;
  try {
    envBag = (await getCfEnv()) as unknown as Record<string, unknown>;
  } catch {
    envBag = undefined;
  }
  const token = await resolveCfApiToken(db, envBag);
  const account = await getKv(db, KV.cfAccountId);
  if (!token || !account) {
    return { configured: false, r2: null, d1: null, worker: null };
  }
  const workerName = (await getKv(db, KV.cfWorkerName)) || "";
  const bucket = (await getKv(db, KV.cfR2Bucket)) || "";
  const databaseId = await getKv(db, KV.cfD1DatabaseId) || "";
  const { from, to } = usageWindow(range);
  const start = from.toISOString();
  const end = to.toISOString();
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);

  const [r2, d1, worker] = await Promise.all([
    fetchR2(token, account, start, end, bucket),
    fetchD1(token, account, start, end, startDate, endDate, databaseId),
    fetchWorker(token, account, start, end, workerName),
  ]);
  const parts = [
    r2.error ? `R2: ${r2.error}` : "",
    d1.error ? `D1: ${d1.error}` : "",
    worker.error ? `Worker: ${worker.error}` : "",
  ].filter(Boolean);
  return {
    configured: true,
    error: parts.length ? parts.join("；") : undefined,
    r2: r2.value,
    d1: d1.value,
    worker: worker.value,
  };
}

export async function getUsage(range: UsageRange): Promise<UsagePayload> {
  const { from, to } = usageWindow(range);
  const [disk, analytics] = await Promise.all([localDisk(), graphqlAnalytics(range)]);
  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    disk,
    analytics,
  };
}
