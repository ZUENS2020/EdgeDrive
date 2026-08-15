import { getKv, KV } from "./app-config";
import { getDB } from "./cloudflare";
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
      const count = await db.prepare(`SELECT COUNT(*) as n FROM "${row.name.replace(/"/g, '""')}"`).first<{ n: number }>();
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

type GqlAccount = {
  r2OperationsAdaptiveGroups?: { sum?: { requests?: number }; dimensions?: { actionType?: string } }[];
  r2StorageAdaptiveGroups?: {
    max?: { objectCount?: number; uploadCount?: number; payloadSize?: number; metadataSize?: number };
  }[];
  d1AnalyticsAdaptiveGroups?: {
    sum?: {
      readQueries?: number;
      writeQueries?: number;
      rowsRead?: number;
      rowsWritten?: number;
      queryBatchResponseBytes?: number;
      queryBatchTimeMs?: number;
    };
  }[];
  d1StorageAdaptiveGroups?: { max?: { databaseSizeBytes?: number } }[];
  workersInvocationsAdaptive?: {
    sum?: { requests?: number; errors?: number; subrequests?: number };
    quantiles?: { cpuTimeP50?: number; cpuTimeP99?: number };
    dimensions?: { status?: string };
  }[];
};

async function graphqlAnalytics(
  range: UsageRange,
): Promise<UsagePayload["analytics"]> {
  const db = await getDB();
  const token = await getKv(db, KV.cfApiToken);
  const account = await getKv(db, KV.cfAccountId);
  if (!token || !account) {
    return { configured: false, r2: null, d1: null, worker: null };
  }
  const workerName = (await getKv(db, KV.cfWorkerName)) || "";
  const bucket = (await getKv(db, KV.cfR2Bucket)) || "";
  const databaseId = (await getKv(db, KV.cfD1DatabaseId)) || "";
  const { from, to } = usageWindow(range);
  const start = from.toISOString();
  const end = to.toISOString();
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);

  const r2OpFilter = bucket
    ? "datetime_geq: $start, datetime_leq: $end, bucketName: $bucketName"
    : "datetime_geq: $start, datetime_leq: $end";
  const r2StoreFilter = r2OpFilter;
  const d1Filter = databaseId
    ? "date_geq: $startDate, date_leq: $endDate, databaseId: $databaseId"
    : "date_geq: $startDate, date_leq: $endDate";
  const workerFilter = workerName
    ? "scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end"
    : "datetime_geq: $start, datetime_leq: $end";

  const query = `
    query Usage(
      $accountTag: string!
      $start: Time!
      $end: Time!
      $startDate: Date!
      $endDate: Date!
      ${bucket ? "$bucketName: string!" : ""}
      ${databaseId ? "$databaseId: string!" : ""}
      ${workerName ? "$scriptName: string!" : ""}
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2OperationsAdaptiveGroups(
            limit: 100
            filter: { ${r2OpFilter} }
          ) {
            sum { requests }
            dimensions { actionType }
          }
          r2StorageAdaptiveGroups(
            limit: 1
            filter: { ${r2StoreFilter} }
            orderBy: [datetime_DESC]
          ) {
            max { objectCount uploadCount payloadSize metadataSize }
          }
          d1AnalyticsAdaptiveGroups(
            limit: 1
            filter: { ${d1Filter} }
          ) {
            sum { readQueries writeQueries rowsRead rowsWritten queryBatchResponseBytes queryBatchTimeMs }
          }
          d1StorageAdaptiveGroups(
            limit: 1
            filter: { ${d1Filter} }
            orderBy: [date_DESC]
          ) {
            max { databaseSizeBytes }
          }
          workersInvocationsAdaptive(
            limit: 50
            filter: { ${workerFilter} }
          ) {
            sum { requests errors subrequests }
            quantiles { cpuTimeP50 cpuTimeP99 }
            dimensions { status }
          }
        }
      }
    }
  `;

  const variables: Record<string, string> = {
    accountTag: account,
    start,
    end,
    startDate,
    endDate,
  };
  if (bucket) variables.bucketName = bucket;
  if (databaseId) variables.databaseId = databaseId;
  if (workerName) variables.scriptName = workerName;

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
    const json = (await res.json()) as {
      data?: { viewer?: { accounts?: GqlAccount[] } };
      errors?: { message?: string }[];
    };
    if (!res.ok || json.errors?.length) {
      return {
        configured: true,
        error: json.errors?.map((e) => e.message).filter(Boolean).join("; ") || `GraphQL HTTP ${res.status}`,
        r2: null,
        d1: null,
        worker: null,
      };
    }
    const acc = json.data?.viewer?.accounts?.[0];
    if (!acc) {
      return { configured: true, error: "账号下没有分析数据", r2: null, d1: null, worker: null };
    }

    const byAction = (acc.r2OperationsAdaptiveGroups || [])
      .map((row) => {
        const action = row.dimensions?.actionType || "unknown";
        const requests = Number(row.sum?.requests || 0);
        return { action, requests, klass: klassOf(action) };
      })
      .filter((row) => row.requests > 0)
      .sort((a, b) => b.requests - a.requests);
    const classA = byAction.filter((r) => r.klass === "A").reduce((n, r) => n + r.requests, 0);
    const classB = byAction.filter((r) => r.klass === "B").reduce((n, r) => n + r.requests, 0);
    const freeOps = byAction.filter((r) => r.klass === "free").reduce((n, r) => n + r.requests, 0);
    const otherOps = byAction.filter((r) => r.klass === "other").reduce((n, r) => n + r.requests, 0);
    const storage = acc.r2StorageAdaptiveGroups?.[0]?.max;

    const d1Sum = acc.d1AnalyticsAdaptiveGroups?.[0]?.sum;
    const d1Size = acc.d1StorageAdaptiveGroups?.[0]?.max?.databaseSizeBytes;

    const workerRows = acc.workersInvocationsAdaptive || [];
    const byStatus = workerRows.map((row) => ({
      status: row.dimensions?.status || "unknown",
      requests: Number(row.sum?.requests || 0),
      errors: Number(row.sum?.errors || 0),
    }));
    const cpuSamples = workerRows.map((r) => r.quantiles).filter(Boolean);

    return {
      configured: true,
      r2: {
        payloadBytes: storage?.payloadSize != null ? Number(storage.payloadSize) : null,
        metadataBytes: storage?.metadataSize != null ? Number(storage.metadataSize) : null,
        objectCount: storage?.objectCount != null ? Number(storage.objectCount) : null,
        uploadCount: storage?.uploadCount != null ? Number(storage.uploadCount) : null,
        classA,
        classB,
        freeOps,
        otherOps,
        byAction,
      },
      d1: d1Sum
        ? {
            readQueries: Number(d1Sum.readQueries || 0),
            writeQueries: Number(d1Sum.writeQueries || 0),
            rowsRead: Number(d1Sum.rowsRead || 0),
            rowsWritten: Number(d1Sum.rowsWritten || 0),
            responseBytes: Number(d1Sum.queryBatchResponseBytes || 0),
            queryTimeMs: Number(d1Sum.queryBatchTimeMs || 0),
            databaseBytes: d1Size != null ? Number(d1Size) : null,
          }
        : {
            readQueries: 0,
            writeQueries: 0,
            rowsRead: 0,
            rowsWritten: 0,
            responseBytes: 0,
            queryTimeMs: 0,
            databaseBytes: d1Size != null ? Number(d1Size) : null,
          },
      worker: {
        requests: byStatus.reduce((n, r) => n + r.requests, 0),
        errors: byStatus.reduce((n, r) => n + r.errors, 0),
        subrequests: workerRows.reduce((n, r) => n + Number(r.sum?.subrequests || 0), 0),
        cpuTimeP50Us: cpuSamples.length ? Number(cpuSamples[0]?.cpuTimeP50 ?? null) : null,
        cpuTimeP99Us: cpuSamples.length
          ? Math.max(...cpuSamples.map((s) => Number(s?.cpuTimeP99 || 0)))
          : null,
        byStatus,
      },
    };
  } catch (err) {
    return {
      configured: true,
      error: String((err as Error).message || err),
      r2: null,
      d1: null,
      worker: null,
    };
  }
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
