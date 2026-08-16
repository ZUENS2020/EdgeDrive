import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const listFiles = vi.fn();
const setFileTags = vi.fn();
const setFileStarred = vi.fn();
const moveFiles = vi.fn();
const getFileById = vi.fn();
const getSettings = vi.fn();

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

vi.mock("@/lib/store", () => ({
  listFiles: (...args: unknown[]) => listFiles(...args),
  setFileTags: (...args: unknown[]) => setFileTags(...args),
  setFileStarred: (...args: unknown[]) => setFileStarred(...args),
  moveFiles: (...args: unknown[]) => moveFiles(...args),
  getFileById: (...args: unknown[]) => getFileById(...args),
}));

vi.mock("@/lib/settings", () => ({
  getSettings: () => getSettings(),
}));

import { GET, PATCH } from "./route";

describe("GET /api/files", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    listFiles.mockReset();
    getSettings.mockReset();
    requireAdmin.mockResolvedValue({ ok: true });
    getSettings.mockResolvedValue({ page_size: 50 });
    listFiles.mockResolvedValue({ files: [], total: 0, allTags: ["合同"] });
  });

  it("passes trash + tag filters", async () => {
    const res = await GET(new Request("https://x/api/files?filter=trash&tag=合同&page=1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { allTags?: string[] };
    expect(body.allTags).toEqual(["合同"]);
    expect(listFiles).toHaveBeenCalledWith(
      expect.objectContaining({ filter: "trash", tag: "合同" }),
    );
  });
});

describe("PATCH /api/files", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    setFileTags.mockReset();
    setFileStarred.mockReset();
    moveFiles.mockReset();
    requireAdmin.mockResolvedValue({ ok: true });
  });

  it("updates tags and star without moving", async () => {
    const res = await PATCH(
      new Request("https://x/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "1", tags: "a, b", starred: 1 }),
      }),
    );
    expect(res.status).toBe(200);
    expect(setFileTags).toHaveBeenCalledWith(["1"], "a,b");
    expect(setFileStarred).toHaveBeenCalledWith(["1"], 1);
    expect(moveFiles).not.toHaveBeenCalled();
  });
});
