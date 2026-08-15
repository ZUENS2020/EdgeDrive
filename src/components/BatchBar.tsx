"use client";

import { Button } from "@/components/ui/button";

export function BatchBar({
  count,
  onExpire,
  onPermanent,
  onExpireNow,
  onDelete,
  onMove,
  onClear,
}: {
  count: number;
  onExpire: () => void;
  onPermanent: () => void;
  onExpireNow: () => void;
  onDelete: () => void;
  onMove: () => void;
  onClear: () => void;
}) {
  if (count <= 0) return null;
  return (
    <div className="batch-bar">
      <span className="n">已选 {count}</span>
      <Button variant="outline" size="sm" type="button" onClick={onExpire}>
        批量有效期
      </Button>
      <Button variant="outline" size="sm" type="button" onClick={onMove}>
        移动到…
      </Button>
      <Button variant="outline" size="sm" type="button" onClick={onPermanent}>
        转永久
      </Button>
      <Button variant="warn" size="sm" type="button" onClick={onExpireNow}>
        立即过期
      </Button>
      <Button variant="destructive" size="sm" type="button" onClick={onDelete}>
        删除
      </Button>
      <span className="sp" style={{ flex: 1 }} />
      <Button variant="ghost" size="sm" type="button" onClick={onClear}>
        取消选择
      </Button>
    </div>
  );
}
