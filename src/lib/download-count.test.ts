import { beforeEach, describe, expect, it, vi } from "vitest";

const waitUntil = vi.fn();
const incrementDownload = vi.fn<(id: string) => Promise<void>>(async () => {});

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ ctx: { waitUntil } }),
}));

vi.mock("./store", () => ({
  incrementDownload: (id: string) => incrementDownload(id),
}));

import { scheduleDownloadIncrement } from "./download-count";

describe("scheduleDownloadIncrement", () => {
  beforeEach(() => {
    waitUntil.mockClear();
    incrementDownload.mockClear();
  });

  it("does not await the D1 write; hands it to waitUntil", async () => {
    let resolveWrite: () => void = () => {};
    incrementDownload.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const started = Date.now();
    await scheduleDownloadIncrement("file-1");
    expect(Date.now() - started).toBeLessThan(50);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(incrementDownload).toHaveBeenCalledWith("file-1");
    resolveWrite();
    await waitUntil.mock.calls[0][0];
  });
});
