import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireAdmin = vi.fn();
const copyFiles = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

vi.mock("@/lib/store", () => ({
  copyFiles: (...args: unknown[]) => copyFiles(...args),
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("https://edgedrive.example/api/files/copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/files/copy", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    copyFiles.mockReset();
    requireAdmin.mockResolvedValue({ ok: true });
  });

  it("rejects unauthenticated callers", async () => {
    requireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    const res = await POST(jsonRequest({ ids: ["1"], target_path: "docs" }));
    expect(res.status).toBe(401);
    expect(copyFiles).not.toHaveBeenCalled();
  });

  it("rejects empty ids and missing target_path", async () => {
    expect((await POST(jsonRequest({ ids: [], target_path: "docs" }))).status).toBe(400);
    expect((await POST(jsonRequest({ ids: ["1"] }))).status).toBe(400);
    expect(copyFiles).not.toHaveBeenCalled();
  });

  it("copies a file into the target folder", async () => {
    copyFiles.mockResolvedValue({
      copied: 1,
      results: [{ id: "src", ok: true, newId: "dst" }],
    });
    const res = await POST(jsonRequest({ ids: ["src"], target_path: "docs" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      copied: 1,
      failed: 0,
      results: [{ id: "src", ok: true, newId: "dst" }],
    });
    expect(copyFiles).toHaveBeenCalledWith(["src"], "docs");
  });

  it("returns 409 with Chinese message on same-name conflict", async () => {
    copyFiles.mockResolvedValue({
      copied: 0,
      results: [{ id: "src", ok: false, error: "file-exists" }],
    });
    const res = await POST(jsonRequest({ ids: ["src"], target_path: "docs" }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string; message?: string };
    expect(body.error).toBe("file-exists");
    expect(body.message).toBe("目标文件夹已有同名文件");
  });

  it("keeps going on batch partial failure", async () => {
    copyFiles.mockResolvedValue({
      copied: 2,
      results: [
        { id: "a", ok: true, newId: "a2" },
        { id: "b", ok: false, error: "file-exists" },
        { id: "c", ok: true, newId: "c2" },
      ],
    });
    const res = await POST(jsonRequest({ ids: ["a", "b", "c"], target_path: "docs" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { copied?: number; failed?: number; results?: { ok: boolean }[] };
    expect(body.copied).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.results?.map((r) => r.ok)).toEqual([true, false, true]);
  });

  it("maps copy-to-self to 400", async () => {
    copyFiles.mockResolvedValue({
      copied: 0,
      results: [{ id: "src", ok: false, error: "same-path" }],
    });
    const res = await POST(jsonRequest({ ids: ["src"], target_path: "docs" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "same-path", message: "不能复制到自身" });
  });

  it("maps missing folder to 409 like move", async () => {
    copyFiles.mockRejectedValue(new Error("folder-not-found"));
    const res = await POST(jsonRequest({ ids: ["src"], target_path: "ghost" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "folder-not-found", message: "文件夹不存在" });
  });
});
