import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireAdmin = vi.fn();
const getDB = vi.fn();
const createShare = vi.fn();
const listShareLinks = vi.fn();

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
    createShare: (...args: unknown[]) => createShare(...args),
    listShareLinks: (...args: unknown[]) => listShareLinks(...args),
  };
});

import { GET, POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("https://edgedrive.example/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/share", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getDB.mockReset();
    createShare.mockReset();
    listShareLinks.mockReset();
  });

  it("rejects unauthenticated callers", async () => {
    requireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const res = await POST(jsonRequest({ kind: "file", ids: ["1"] }));
    expect(res.status).toBe(401);
    expect(createShare).not.toHaveBeenCalled();
  });

  it("creates a file share and returns long/view urls", async () => {
    requireAdmin.mockResolvedValue({ ok: true });
    getDB.mockResolvedValue({});
    createShare.mockResolvedValue({
      ok: true,
      token: "tok",
      kind: "file",
      url: "/dl/a.txt?t=tok",
      viewUrl: "/dl/a.txt/view?t=tok",
      downloadUrl: "/dl/a.txt?t=tok",
      shortUrl: null,
      shortCode: null,
      count: 1,
      expiresAt: null,
      reused: false,
      hasPassword: false,
    });
    const res = await POST(jsonRequest({ kind: "file", ids: ["1"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      token: "tok",
      url: "/dl/a.txt?t=tok",
      viewUrl: "/dl/a.txt/view?t=tok",
    });
  });
});

describe("GET /api/share", () => {
  it("lists links for admins", async () => {
    requireAdmin.mockResolvedValue({ ok: true });
    getDB.mockResolvedValue({});
    listShareLinks.mockResolvedValue([{ token: "a", kind: "file" }]);
    const res = await GET(new Request("https://edgedrive.example/api/share?kind=file"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ links: [{ token: "a", kind: "file" }], total: 1 });
    expect(listShareLinks).toHaveBeenCalledWith({}, expect.objectContaining({ kind: "file" }));
  });
});
