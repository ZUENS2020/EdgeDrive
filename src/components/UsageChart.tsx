"use client";

import { useEffect, useRef, useState } from "react";
import { numberLocale, type Locale } from "@/lib/i18n";
import type { UsageBar } from "@/lib/usage-charts";

export function UsageBarChart({
  items,
  locale = "zh",
  emptyLabel,
  ariaLabel,
}: {
  items: UsageBar[];
  locale?: Locale;
  emptyLabel: string;
  ariaLabel: string;
}) {
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
    return <p className="usage-chart-empty">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...items.map((item) => item.value));
  const track = Math.max(0, width - 96);

  return (
    <div ref={ref} className="usage-chart" role="img" aria-label={ariaLabel}>
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
            <span className="usage-bar-n">{formatBarValue(item.value, locale)}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatBarValue(value: number, locale: Locale): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat(numberLocale(locale)).format(Math.round(value));
}
