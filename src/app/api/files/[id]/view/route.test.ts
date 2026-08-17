import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireAdmin = vi.fn();
const getFileById = vi.fn();
const getSettings = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

vi.mock("@/lib/store", () => ({
  getFileById: (...args: unknown[]) => getFileById(...args),
}));

vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  return { ...actual, getSettings: () => getSettings() };
});

import { GET } from "./route";

const meta = {
  id: "abc",
  name: "a.txt",
  path: "docs",
  size: 4,
  mime: "text/plain",
  expires: null,
  download_count: 0,
  created_at: "2026-08-16T00:00:00.000Z",
  tags: "",
  deleted_at: null,
  starred: 0,
  sha256: null,
};

describe("GET /api/files/[id]/view", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getFileById.mockReset();
    getSettings.mockReset();
    requireAdmin.mockResolvedValue({ ok: true });
    getFileById.mockResolvedValue(meta);
    getSettings.mockResolvedValue({ theme_name: "default", language: "zh" });
  });

  it("embeds absolute copy URLs even when the worker URL differs from the public host", async () => {
    const req = new NextRequest("http://localhost:8787/api/files/abc/view", {
      headers: {
        host: "localhost:8787",
        "x-forwarded-host": "dlp.zuens2020.work",
        "x-forwarded-proto": "https",
      },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-copy="https://dlp.zuens2020.work/api/files/abc/content"');
    expect(html).toContain('data-copy="https://dlp.zuens2020.work/api/files/abc/view"');
    expect(html).not.toMatch(/data-copy="\/api\/files/);
    expect(html).toContain("new URL(");
  });

  it("rejects unauthenticated callers", async () => {
    requireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const res = await GET(new NextRequest("https://dlp.zuens2020.work/api/files/abc/view"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(401);
  });
});
