import { describe, expect, it, vi } from "vitest";
import {
  TOKEN_CLEAR_CONFIRM_MESSAGE,
  resolveTokenClearConfirm,
} from "./token-clear-confirm";

describe("token clear confirm dialog", () => {
  it("exposes the usage-stats warning copy", () => {
    expect(TOKEN_CLEAR_CONFIRM_MESSAGE).toBe(
      "确定清除已配置的 Cloudflare API Token？清除后用量统计将不可用。",
    );
  });

  it("clears token only after confirm", () => {
    const onClear = vi.fn();
    if (resolveTokenClearConfirm("confirm").run) onClear();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("does not clear token on cancel", () => {
    const onClear = vi.fn();
    if (resolveTokenClearConfirm("cancel").run) onClear();
    expect(onClear).not.toHaveBeenCalled();
  });
});
