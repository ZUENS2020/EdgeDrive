export type UsageBar = { label: string; value: number };

export function topBars(items: UsageBar[], limit = 6): UsageBar[] {
  return items
    .filter((item) => Number.isFinite(item.value) && item.value >= 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
