import { describe, expect, it, vi } from "vitest";
import { runPool, uploadMpuParts, withRetries } from "./mpu-pool";

describe("withRetries", () => {
  it("retries twice then succeeds", async () => {
    let n = 0;
    const sleepFn = vi.fn(async () => {});
    const value = await withRetries(
      async () => {
        n++;
        if (n < 3) throw new Error("fail");
        return "ok";
      },
      { retries: 2, backoffMs: [1, 2], sleepFn },
    );
    expect(value).toBe("ok");
    expect(n).toBe(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  it("throws after retries exhausted", async () => {
    const sleepFn = vi.fn(async () => {});
    await expect(
      withRetries(
        async () => {
          throw new Error("nope");
        },
        { retries: 2, backoffMs: [1, 2], sleepFn },
      ),
    ).rejects.toThrow("nope");
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });
});

describe("runPool", () => {
  it("never starts more than concurrency tasks at once", async () => {
    let inflight = 0;
    let max = 0;
    const tasks = Array.from({ length: 8 }, (_, i) => async () => {
      inflight++;
      max = Math.max(max, inflight);
      await new Promise((r) => setTimeout(r, 20));
      inflight--;
      return i;
    });
    const out = await runPool(tasks, 3);
    expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(max).toBeLessThanOrEqual(3);
    expect(max).toBe(3);
  });

  it("stops taking new work after a failure", async () => {
    let started = 0;
    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      started++;
      if (i === 1) throw new Error("boom");
      await new Promise((r) => setTimeout(r, 5));
      return i;
    });
    await expect(runPool(tasks, 2)).rejects.toThrow("boom");
    expect(started).toBeLessThan(6);
  });
});

describe("uploadMpuParts", () => {
  it("reports progress by completed parts", async () => {
    const progress: number[] = [];
    const parts = await uploadMpuParts({
      total: 5,
      concurrency: 2,
      retries: 0,
      sleepFn: async () => {},
      onProgress: (done) => progress.push(done),
      uploadPart: async (partNumber) => ({ partNumber, etag: `e${partNumber}` }),
    });
    expect(parts.map((p) => p.partNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(progress[progress.length - 1]).toBe(5);
  });
});
