"use client";

import type { FolderNode } from "@/lib/types";
import { PickFolderDialog } from "./PickFolderDialog";

export function MoveDialog({
  open,
  count,
  folders,
  onClose,
  onSubmit,
}: {
  open: boolean;
  count: number;
  folders: FolderNode[];
  onClose: () => void;
  onSubmit: (path: string) => void;
}) {
  return (
    <PickFolderDialog
      open={open}
      title={`移动到文件夹${count > 1 ? `（${count} 个）` : ""}`}
      confirmLabel="移动"
      folders={folders}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
