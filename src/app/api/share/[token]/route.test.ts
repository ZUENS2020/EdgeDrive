import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const getDB = vi.fn();
const patchShare = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

vi.mock("@/lib/cloudflare", () => ({
  getDB: () => getDB(),
}));

vi.mock("@/lib/share", async () => {
  const actual = await vi.importActual<typeof import("@/lib/share")>("@/lib/share");
  return {
    ...actual,
    patchShare: (...args: unknown[]) => patchShare(...args),
  };
});

import { PATCH } from "./route";

function jsonRequest(token: string, body: unknown) {
  return new Request(`https://edgedrive.example/api/share/${token}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/share/[token]", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getDB.mockReset();
    patchShare.mockReset();
    requireAdmin.mockResolvedValue({ ok: true });
    getDB.mockResolvedValue({});
  });

  it("updates allow_download / allow_preview", async () => {
    patchShare.mockResolvedValue({
      ok: true,
      link: { token: "tok", allow_download: false, allow_preview: true },
    });
    const res = await PATCH(jsonRequest("tok", { allow_download: 0, allow_preview: 1 }), {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(200);
    expect(patchShare).toHaveBeenCalledWith({}, "tok", { allow_download: 0, allow_preview: 1 });
    expect(await res.json()).toEqual({
      link: { token: "tok", allow_download: false, allow_preview: true },
    });
  });

  it("returns 400 when patchShare rejects 0/0", async () => {
    patchShare.mockResolvedValue({ ok: false, status: 400, error: "need download or preview" });
    const res = await PATCH(jsonRequest("tok", { allow_download: 0, allow_preview: 0 }), {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "need download or preview" });
  });
});
