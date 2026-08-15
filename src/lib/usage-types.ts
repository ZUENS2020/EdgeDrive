export type UsageRange = "24h" | "7d" | "month";

export type UsagePayload = {
  range: UsageRange;
  from: string;
  to: string;
  disk: {
    files: number;
    folders: number;
    catalogBytes: number;
    downloads: number;
    expired: number;
    soon: number;
    tables: { name: string; rows: number }[];
    sqliteBytes: number | null;
  };
  analytics: {
    configured: boolean;
    error?: string;
    r2: {
      payloadBytes: number | null;
      metadataBytes: number | null;
      objectCount: number | null;
      uploadCount: number | null;
      classA: number;
      classB: number;
      freeOps: number;
      otherOps: number;
      byAction: { action: string; requests: number; klass: "A" | "B" | "free" | "other" }[];
    } | null;
    d1: {
      readQueries: number;
      writeQueries: number;
      rowsRead: number;
      rowsWritten: number;
      responseBytes: number;
      queryTimeMs: number;
      databaseBytes: number | null;
    } | null;
    worker: {
      requests: number;
      errors: number;
      subrequests: number;
      cpuTimeP50Us: number | null;
      cpuTimeP99Us: number | null;
      byStatus: { status: string; requests: number; errors: number }[];
    } | null;
  };
};
