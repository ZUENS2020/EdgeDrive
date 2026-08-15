"use client";

import { useEffect, useState } from "react";
import type { FolderNode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderPicker } from "./FolderPicker";

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
  const [path, setPath] = useState("");
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (open) {
      setPath("");
      setSession((n) => n + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移动到文件夹{count > 1 ? `（${count} 个）` : ""}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-1">
          <FolderPicker key={session} folders={folders} value={path} onChange={setPath} />
          <p className="folder-picker-hint">目标：{path || "根目录"}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={() => onSubmit(path)}>
            移动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
