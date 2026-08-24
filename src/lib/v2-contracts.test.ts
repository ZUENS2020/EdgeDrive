import { describe, expect, it } from "vitest";
import { batchActionSchema, prepareUploadSchema, shareCreateSchema, settingsPatchSchema } from "./v2-contracts";

describe("v2 API contracts", () => {
  it("normalizes SHA-256 and rejects invalid upload metadata", () => {
    const parsed = prepareUploadSchema.parse({
      folderId: null,
      name: "report.pdf",
      mime: "application/pdf",
      size: 42,
      sha256: "A".repeat(64),
    });
    expect(parsed.sha256).toBe("a".repeat(64));
    expect(() => prepareUploadSchema.parse({ ...parsed, name: "" })).toThrow();
  });

  it("requires at least one share capability", () => {
    expect(shareCreateSchema.safeParse({ fileIds: [crypto.randomUUID()], allowDownload: false, allowPreview: false }).success).toBe(false);
    expect(shareCreateSchema.safeParse({ fileIds: [crypto.randomUUID()], allowDownload: true, allowPreview: false }).success).toBe(true);
  });

  it("caps batches and validates retention settings", () => {
    expect(batchActionSchema.safeParse({ action: "trash", ids: Array.from({ length: 101 }, () => crypto.randomUUID()) }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ trashRetentionDays: 0 }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ trashRetentionDays: 30 }).success).toBe(true);
  });
});
