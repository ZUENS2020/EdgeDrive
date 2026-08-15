"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MoveDialog({
  open,
  count,
  folders,
  onClose,
  onSubmit,
}: {
  open: boolean;
  count: number;
  folders: { path: string; label: string }[];
  onClose: () => void;
  onSubmit: (path: string) => void;
}) {
  const [path, setPath] = useState("");

  useEffect(() => {
    if (open) setPath("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>移动到文件夹{count > 1 ? `（${count} 个）` : ""}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label>目标</Label>
          <Select value={path || "__root__"} onValueChange={(v) => setPath(v === "__root__" ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">根目录</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.path} value={f.path}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
