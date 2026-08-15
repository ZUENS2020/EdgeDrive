"use client";

import { useMemo, useState } from "react";
import { parseExpireInput } from "@/lib/expires";
import { formatTime } from "@/lib/format";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

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
    <Modal open={open} title={count > 1 ? `设置有效期（${count} 个文件）` : "设置有效期"} onClose={onClose}>
      <p>永久 / 限时（小时、天、截止时间）/ 自定义。到期后直链返回 410，文件仍保留。</p>
      <div className="seg">
        <button type="button" className={mode === "dur" ? "on" : ""} onClick={() => setMode("dur")}>
          持续时长
        </button>
        <button type="button" className={mode === "until" ? "on" : ""} onClick={() => setMode("until")}>
          截止时间
        </button>
        <button type="button" className={mode === "perm" ? "on" : ""} onClick={() => setMode("perm")}>
          永久
        </button>
      </div>
      {mode === "dur" && (
        <>
          <div className="chip-row">
            <button className="chip" type="button" onClick={() => { setN("24"); setUnit("hours"); }}>
              +24h
            </button>
            <button className="chip" type="button" onClick={() => { setN("7"); setUnit("days"); }}>
              +7 天
            </button>
            <button className="chip" type="button" onClick={() => { setN("30"); setUnit("days"); }}>
              +30 天
            </button>
          </div>
          <div className="exp-custom">
            <input className="num" type="number" min="0" step="any" value={n} onChange={(e) => setN(e.target.value)} />
            <select value={unit} onChange={(e) => setUnit(e.target.value as "hours" | "days")}>
              <option value="hours">小时</option>
              <option value="days">天</option>
            </select>
          </div>
        </>
      )}
      {mode === "until" && (
        <div className="until-row">
          <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
      )}
      <p className="exp-preview">{preview}</p>
      <div className="modal-acts">
        <Button variant="warn" type="button" onClick={() => onSubmit({ action: "expireNow" })}>
          立即过期
        </Button>
        <span className="sp" />
        <Button type="button" onClick={onClose}>
          取消
        </Button>
        <Button
          variant="primary"
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
    </Modal>
  );
}
