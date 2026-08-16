import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireAdmin = vi.fn();
const instantCopy = vi.fn();
const getSettings = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

vi.mock("@/lib/store", () => ({
  instantCopy: (...args: unknown[]) => instantCopy(...args),
}));

vi.mock("@/lib/settings", () => ({
  getSettings: () => getSettings(),
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("https://edgedrive.example/api/files/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const HASH = "a".repeat(64);

describe("POST /api/files/check", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    instantCopy.mockReset();
    getSettings.mockReset();
    getSettings.mockResolvedValue({ default_expires: "24h" });
  });

  it("rejects unauthenticated callers", async () => {
    requireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const res = await POST(jsonRequest({ sha256: HASH, name: "a.bin" }));
    expect(res.status).toBe(401);
    expect(instantCopy).not.toHaveBeenCalled();
  });

  it("returns hit:false on miss", async () => {
    requireAdmin.mockResolvedValue({ ok: true });
    instantCopy.mockResolvedValue({ error: "miss" });
    const res = await POST(jsonRequest({ sha256: HASH, name: "a.bin", path: "" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hit: false });
  });

  it("returns instant payload on hit", async () => {
    requireAdmin.mockResolvedValue({ ok: true });
    instantCopy.mockResolvedValue({
      id: "id-1",
      key: "docs/a.bin",
      size: 12,
      mime: "application/octet-stream",
    });
    const res = await POST(jsonRequest({ sha256: HASH, name: "a.bin", path: "docs", permanent: true }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hit?: boolean; instant?: boolean; id?: string; url?: string };
    expect(body.hit).toBe(true);
    expect(body.instant).toBe(true);
    expect(body.id).toBe("id-1");
    expect(body.url).toBe("/dl/docs/a.bin");
    expect(instantCopy).toHaveBeenCalledWith(
      expect.objectContaining({ sha256: HASH, name: "a.bin", path: "docs", expires: null }),
    );
  });

  it("rejects a bad hash", async () => {
    requireAdmin.mockResolvedValue({ ok: true });
    const res = await POST(jsonRequest({ sha256: "nope", name: "a.bin" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad-sha256" });
  });
});
