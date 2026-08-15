"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  title,
  body,
  ok = "确定",
  danger,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  ok?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            取消
          </Button>
          <Button variant={danger ? "destructive" : "default"} type="button" onClick={onConfirm}>
            {ok}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
