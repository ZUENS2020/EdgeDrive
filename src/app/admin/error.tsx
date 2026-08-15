"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="home-wrap">
      <div className="home-card">
        <h1>管理页渲染失败</h1>
        <p>页面出错了，请重试。若持续出现，请查看 Worker 日志。</p>
        <p className="flex gap-2">
          <Button type="button" onClick={() => reset()}>
            重试
          </Button>
          <Button variant="outline" asChild>
            <a href="/admin">强制刷新</a>
          </Button>
        </p>
      </div>
    </div>
  );
}
