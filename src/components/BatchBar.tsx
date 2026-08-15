"use client";

import { Button } from "@/components/ui/button";

export function SelectionBar({
  count,
  single,
  onCopyDownload,
  onCopyView,
  onRename,
  onMove,
  onExpire,
  onDelete,
  onClear,
}: {
  count: number;
  single: boolean;
  onCopyDownload: () => void;
  onCopyView: () => void;
  onRename: () => void;
  onMove: () => void;
  onExpire: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (count <= 0) return null;
  return (
    <div className="file-toolbar" role="toolbar" aria-label="已选文件操作">
      <span className="n">已选 {count}</span>
      <span className="file-toolbar-sep" aria-hidden />
      <Button variant="outline" size="sm" type="button" onClick={onCopyDownload}>
        {single ? "复制下载" : "复制下载链接"}
      </Button>
      {single ? (
        <Button variant="outline" size="sm" type="button" onClick={onCopyView}>
          复制预览
        </Button>
      ) : null}
      <span className="file-toolbar-sep" aria-hidden />
      {single ? (
        <Button variant="outline" size="sm" type="button" onClick={onRename}>
          改名
        </Button>
      ) : null}
      <Button variant="outline" size="sm" type="button" onClick={onMove}>
        移动
      </Button>
      <Button variant="outline" size="sm" type="button" onClick={onExpire}>
        有效期
      </Button>
      <span className="file-toolbar-sep" aria-hidden />
      <Button variant="destructive" size="sm" type="button" onClick={onDelete}>
        删除
      </Button>
      <span className="sp" />
      <Button variant="ghost" size="sm" type="button" onClick={onClear}>
        取消
      </Button>
    </div>
  );
}
