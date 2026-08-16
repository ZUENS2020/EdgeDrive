import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireAdmin = vi.fn();
const getDB = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

vi.mock("@/lib/cloudflare", () => ({
  getDB: () => getDB(),
}));

vi.mock("@/lib/batch", () => ({
  handleCreateBatch: vi.fn(),
}));

import { handleCreateBatch } from "@/lib/batch";
import { POST } from "./route";

const handleCreateBatchMock = vi.mocked(handleCreateBatch);

function jsonRequest(body: unknown) {
  return new Request("https://edgedrive.example/api/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/batch", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getDB.mockReset();
    handleCreateBatchMock.mockReset();
  });

  it("rejects unauthenticated callers", async () => {
    requireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const res = await POST(jsonRequest({ ids: ["1"] }));
    expect(res.status).toBe(401);
    expect(handleCreateBatchMock).not.toHaveBeenCalled();
  });

  it("rejects setup-mode callers", async () => {
    requireAdmin.mockResolvedValue({
      ok: false,
      setup: true,
      response: NextResponse.json({ error: "setup-required" }, { status: 403 }),
    });
    const res = await POST(jsonRequest({ ids: ["1"] }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "setup-required" });
  });

  it("rejects invalid json", async () => {
    requireAdmin.mockResolvedValue({ ok: true });
    const res = await POST(
      new Request("https://edgedrive.example/api/batch", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid json" });
  });

  it("returns preview/download urls from handleCreateBatch", async () => {
    requireAdmin.mockResolvedValue({ ok: true });
    getDB.mockResolvedValue({});
    handleCreateBatchMock.mockResolvedValue({
      ok: true,
      previewUrl: "/dl/batch/tok",
      downloadUrl: "/dl/batch/tok?mode=download",
      count: 2,
      expiresAt: null,
    });
    const res = await POST(jsonRequest({ ids: ["a", "b"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      previewUrl: "/dl/batch/tok",
      downloadUrl: "/dl/batch/tok?mode=download",
      count: 2,
      expiresAt: null,
    });
    expect(handleCreateBatchMock).toHaveBeenCalledWith({}, { ids: ["a", "b"] });
  });

  it("forwards parameter errors", async () => {
    requireAdmin.mockResolvedValue({ ok: true });
    getDB.mockResolvedValue({});
    handleCreateBatchMock.mockResolvedValue({ ok: false, status: 400, error: "need ids" });
    const res = await POST(jsonRequest({ ids: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "need ids" });
  });
});
