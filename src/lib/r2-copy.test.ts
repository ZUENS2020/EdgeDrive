import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const put = vi.fn();

vi.mock("@/lib/cloudflare", () => ({
  getR2: async () => ({ get, put }),
}));

import { copyObject } from "./r2-copy";

describe("copyObject", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it("skips I/O when src and dst keys match", async () => {
    const result = await copyObject("docs/a.txt", "docs/a.txt");
    expect(result).toEqual({ ok: true, skipped: true });
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("streams the source body into put (never buffers)", async () => {
    const body = { kind: "readable-stream" };
    get.mockResolvedValue({
      body,
      httpMetadata: { contentType: "text/plain" },
      customMetadata: { expires: "soon" },
    });
    put.mockResolvedValue({});
    const result = await copyObject("a.txt", "docs/a.txt");
    expect(result).toEqual({ ok: true, skipped: false });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe("docs/a.txt");
    expect(put.mock.calls[0][1]).toBe(body);
    expect(put.mock.calls[0][2]).toEqual({
      httpMetadata: { contentType: "text/plain" },
      customMetadata: { expires: "soon" },
    });
  });

  it("overrides customMetadata when provided", async () => {
    const body = {};
    get.mockResolvedValue({
      body,
      httpMetadata: { contentType: "image/png" },
      customMetadata: { expires: "old" },
    });
    put.mockResolvedValue({});
    await copyObject("a.png", "b.png", { customMetadata: { expires: "new" } });
    expect(put.mock.calls[0][2]).toEqual({
      httpMetadata: { contentType: "image/png" },
      customMetadata: { expires: "new" },
    });
  });

  it("returns miss when the source object is absent", async () => {
    get.mockResolvedValue(null);
    const result = await copyObject("gone.bin", "copy.bin");
    expect(result).toEqual({ ok: false, error: "miss" });
    expect(put).not.toHaveBeenCalled();
  });
});
