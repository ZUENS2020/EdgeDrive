"use client";

import { useEffect, useRef, useState } from "react";
import type { UsageBar } from "@/lib/usage-charts";

export function UsageBarChart({ items }: { items: UsageBar[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (items.length === 0) {
    return <p className="usage-chart-empty">暂无图表数据</p>;
  }

  const max = Math.max(1, ...items.map((item) => item.value));
  const track = Math.max(0, width - 96);

  return (
    <div ref={ref} className="usage-chart" role="img" aria-label="用量分布">
      {items.map((item) => {
        const pct = (item.value / max) * 100;
        const px = width > 0 ? Math.max(item.value > 0 ? 2 : 0, (track * pct) / 100) : 0;
        return (
          <div className="usage-bar" key={item.label}>
            <span className="usage-bar-label" title={item.label}>
              {item.label}
            </span>
            <span className="usage-bar-track">
              <i style={{ width: width > 0 ? `${px}px` : `${pct}%` }} />
            </span>
            <span className="usage-bar-n">{formatBarValue(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatBarValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}
