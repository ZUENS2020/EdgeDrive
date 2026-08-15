/** MPU 分片并发池：同时跑有限片数，单片失败指数退避重试。 */

export const MPU_CONCURRENCY = 4;
export const MPU_RETRIES = 2;
export const MPU_BACKOFF_MS = [1000, 2000] as const;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; backoffMs?: readonly number[]; sleepFn?: (ms: number) => Promise<void> },
): Promise<T> {
  const retries = opts?.retries ?? MPU_RETRIES;
  const backoff = opts?.backoffMs ?? MPU_BACKOFF_MS;
  const pause = opts?.sleepFn ?? sleep;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt >= retries) break;
      await pause(backoff[attempt] ?? backoff[backoff.length - 1] ?? 1000);
    }
  }
  throw last;
}

/**
 * 固定并发池。用计数器领取下一个任务，不要 Promise.all 一次铺开。
 * 任一任务失败后不再领取新任务；已在飞的会跑完或抛错。
 */
export async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onDone?: (completed: number, total: number) => void,
): Promise<T[]> {
  const total = tasks.length;
  const results = new Array<T>(total);
  let next = 0;
  let completed = 0;
  let failed: unknown;

  async function worker() {
    while (true) {
      if (failed) return;
      const i = next++;
      if (i >= total) return;
      try {
        results[i] = await tasks[i]();
        completed++;
        onDone?.(completed, total);
      } catch (err) {
        failed = err;
        throw err;
      }
    }
  }

  const n = Math.max(1, Math.min(concurrency, total || 1));
  const workers = Array.from({ length: total === 0 ? 0 : n }, () => worker());
  const settled = await Promise.allSettled(workers);
  if (failed) throw failed;
  const rejected = settled.find((s) => s.status === "rejected");
  if (rejected && rejected.status === "rejected") throw rejected.reason;
  return results;
}

export async function uploadMpuParts(opts: {
  total: number;
  concurrency?: number;
  uploadPart: (partNumber: number) => Promise<{ partNumber: number; etag: string }>;
  onProgress?: (completed: number, total: number) => void;
  retries?: number;
  backoffMs?: readonly number[];
  sleepFn?: (ms: number) => Promise<void>;
}): Promise<{ partNumber: number; etag: string }[]> {
  const total = opts.total;
  const tasks = Array.from({ length: total }, (_, i) => {
    const partNumber = i + 1;
    return () =>
      withRetries(() => opts.uploadPart(partNumber), {
        retries: opts.retries,
        backoffMs: opts.backoffMs,
        sleepFn: opts.sleepFn,
      });
  });
  return runPool(tasks, opts.concurrency ?? MPU_CONCURRENCY, opts.onProgress);
}
