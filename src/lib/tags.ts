export const MAX_TAGS = 20;
export const MAX_TAG_LEN = 32;

/** Split comma / Chinese-comma lists, trim, de-dupe (case-insensitive), cap length. */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(/[,，]/)) {
    if (/[\x00-\x1f\x7f]/.test(part)) continue;
    const tag = part.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    const clipped = tag.slice(0, MAX_TAG_LEN);
    const key = clipped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clipped);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function serializeTags(tags: string[] | string | null | undefined): string {
  if (Array.isArray(tags)) return parseTags(tags.join(",")).join(",");
  return parseTags(tags).join(",");
}

export function collectUniqueTags(rows: { tags?: string | null }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    for (const tag of parseTags(row.tags)) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, "zh"));
}
