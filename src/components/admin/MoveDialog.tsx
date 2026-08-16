"use client";

import type { FolderNode } from "@/lib/types";
import { useI18n } from "./I18nProvider";
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
  const { t } = useI18n();
  return (
    <PickFolderDialog
      open={open}
      title={count > 1 ? t("fileManager.moveTitleN", { count }) : t("fileManager.moveTitle")}
      confirmLabel={t("fileManager.move")}
      folders={folders}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
