import { describe, expect, it, vi } from "vitest";
import { PURGE_CONFIRM_MESSAGE, resolvePurgeConfirm } from "./purge-confirm";

describe("purge confirm dialog", () => {
  it("exposes the irreversible warning copy", () => {
    expect(PURGE_CONFIRM_MESSAGE).toBe("确定立即清理所有过期文件？此操作不可撤销");
  });

  it("runs purge only after confirm", () => {
    const onPurge = vi.fn();
    if (resolvePurgeConfirm("confirm").run) onPurge();
    expect(onPurge).toHaveBeenCalledTimes(1);
  });

  it("does not run purge on cancel", () => {
    const onPurge = vi.fn();
    if (resolvePurgeConfirm("cancel").run) onPurge();
    expect(onPurge).not.toHaveBeenCalled();
  });
});
