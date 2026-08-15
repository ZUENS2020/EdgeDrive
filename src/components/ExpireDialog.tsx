"use client";

import { useMemo, useState } from "react";
import { parseExpireInput } from "@/lib/expires";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ExpireSubmit =
  | { action: "permanent" }
  | { action: "expireNow" }
  | { action: "expire"; hours?: number; days?: number; expires?: string };

export function ExpireDialog({
  open,
  count,
  onClose,
  onSubmit,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
  onSubmit: (payload: ExpireSubmit) => void;
}) {
  const [mode, setMode] = useState<"dur" | "until" | "perm">("dur");
  const [n, setN] = useState("24");
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const [until, setUntil] = useState("");

  const preview = useMemo(() => {
    if (mode === "perm") return "永久（expires = null）";
    if (mode === "until") {
      const parsed = parseExpireInput({ expires: until ? new Date(until).toISOString() : undefined });
      return parsed.value ? `截止 ${formatTime(parsed.value)}` : "请选择截止时间";
    }
    const num = Number(n);
    const parsed = parseExpireInput(unit === "days" ? { days: num } : { hours: num });
    return parsed.value ? `到期 ${formatTime(parsed.value)}` : parsed.error || "";
  }, [mode, n, unit, until]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{count > 1 ? `设置有效期（${count} 个文件）` : "设置有效期"}</DialogTitle>
          <DialogDescription>
            永久 / 限时（小时、天、截止时间）。到期后下载返回 410，文件仍保留。
          </DialogDescription>
        </DialogHeader>
        <div className="seg">
          <button type="button" className={cn(mode === "dur" && "on")} onClick={() => setMode("dur")}>
            持续时长
          </button>
          <button type="button" className={cn(mode === "until" && "on")} onClick={() => setMode("until")}>
            截止时间
          </button>
          <button type="button" className={cn(mode === "perm" && "on")} onClick={() => setMode("perm")}>
            永久
          </button>
        </div>
        {mode === "dur" && (
          <>
            <div className="chip-row">
              <button
                className="chip"
                type="button"
                onClick={() => {
                  setN("24");
                  setUnit("hours");
                }}
              >
                +24h
              </button>
              <button
                className="chip"
                type="button"
                onClick={() => {
                  setN("7");
                  setUnit("days");
                }}
              >
                +7 天
              </button>
              <button
                className="chip"
                type="button"
                onClick={() => {
                  setN("30");
                  setUnit("days");
                }}
              >
                +30 天
              </button>
            </div>
            <div className="exp-custom">
              <Input className="num" type="number" min="0" step="any" value={n} onChange={(e) => setN(e.target.value)} />
              <select value={unit} onChange={(e) => setUnit(e.target.value as "hours" | "days")}>
                <option value="hours">小时</option>
                <option value="days">天</option>
              </select>
            </div>
          </>
        )}
        {mode === "until" && (
          <div className="until-row">
            <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        )}
        <p className="exp-preview">{preview}</p>
        <DialogFooter className="sm:justify-between">
          <Button variant="warn" type="button" onClick={() => onSubmit({ action: "expireNow" })}>
            立即过期
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (mode === "perm") return onSubmit({ action: "permanent" });
                if (mode === "until") {
                  if (!until) return;
                  return onSubmit({ action: "expire", expires: new Date(until).toISOString() });
                }
                const num = Number(n);
                if (!Number.isFinite(num) || num <= 0) return;
                onSubmit(unit === "days" ? { action: "expire", days: num } : { action: "expire", hours: num });
              }}
            >
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
