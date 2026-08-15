"use client";

import { Button } from "./ui/Button";

export function BatchBar({
  count,
  onExpire,
  onPermanent,
  onExpireNow,
  onDelete,
  onClear,
}: {
  count: number;
  onExpire: () => void;
  onPermanent: () => void;
  onExpireNow: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (count <= 0) return null;
  return (
    <div className="batch-bar">
      <span className="n">已选 {count}</span>
      <Button type="button" onClick={onExpire}>
        批量有效期
      </Button>
      <Button type="button" onClick={onPermanent}>
        转永久
      </Button>
      <Button variant="warn" type="button" onClick={onExpireNow}>
        立即过期
      </Button>
      <Button variant="danger" type="button" onClick={onDelete}>
        删除
      </Button>
      <span className="sp" style={{ flex: 1 }} />
      <Button variant="ghost" type="button" onClick={onClear}>
        取消选择
      </Button>
    </div>
  );
}
