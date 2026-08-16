import { describe, expect, it, vi } from "vitest";
import {
  FOLDER_DELETE_CONFIRM_TITLE,
  folderDeleteConfirmMessage,
  resolveFolderDeleteConfirm,
} from "./folder-delete-confirm";

describe("folder delete confirm dialog", () => {
  it("exposes title and irreversible warning copy", () => {
    expect(FOLDER_DELETE_CONFIRM_TITLE).toBe("删除文件夹");
    expect(folderDeleteConfirmMessage("资料")).toBe(
      "确定删除文件夹「资料」及其中的所有文件？此操作无法撤销。",
    );
  });

  it("runs delete only after confirm", () => {
    const onDelete = vi.fn();
    if (resolveFolderDeleteConfirm("confirm").run) onDelete();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not run delete on cancel", () => {
    const onDelete = vi.fn();
    if (resolveFolderDeleteConfirm("cancel").run) onDelete();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
