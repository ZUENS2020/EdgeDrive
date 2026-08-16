import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const softDeleteFiles = vi.fn();
const restoreFiles = vi.fn();
const deleteFiles = vi.fn();
const setFileExpires = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

vi.mock("@/lib/store", () => ({
  softDeleteFiles: (...args: unknown[]) => softDeleteFiles(...args),
  restoreFiles: (...args: unknown[]) => restoreFiles(...args),
  deleteFiles: (...args: unknown[]) => deleteFiles(...args),
  setFileExpires: (...args: unknown[]) => setFileExpires(...args),
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("https://edgedrive.example/api/files/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/files/batch", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    softDeleteFiles.mockReset();
    restoreFiles.mockReset();
    deleteFiles.mockReset();
    setFileExpires.mockReset();
    requireAdmin.mockResolvedValue({ ok: true });
  });

  it("soft-deletes on action=delete", async () => {
    softDeleteFiles.mockResolvedValue({ deleted: 2 });
    const res = await POST(jsonRequest({ ids: ["a", "b"], action: "delete" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 2 });
    expect(softDeleteFiles).toHaveBeenCalledWith(["a", "b"]);
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it("restores and maps file-exists to 409", async () => {
    restoreFiles.mockRejectedValue(new Error("file-exists"));
    const res = await POST(jsonRequest({ ids: ["a"], action: "restore" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "file-exists" });
  });

  it("hard-deletes on action=purge", async () => {
    deleteFiles.mockResolvedValue({ deleted: 1 });
    const res = await POST(jsonRequest({ ids: ["a"], action: "purge" }));
    expect(await res.json()).toEqual({ ok: true, deleted: 1 });
    expect(deleteFiles).toHaveBeenCalledWith(["a"]);
  });

  it("rejects missing ids", async () => {
    const res = await POST(jsonRequest({ action: "delete" }));
    expect(res.status).toBe(400);
  });
});
