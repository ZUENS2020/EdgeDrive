"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationBar({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="pager">
      <Button variant="outline" size="sm" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft />
        上一页
      </Button>
      <span>
        {page} / {pages} · 共 {total}
      </span>
      <Button variant="outline" size="sm" type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        下一页
        <ChevronRight />
      </Button>
    </div>
  );
}
