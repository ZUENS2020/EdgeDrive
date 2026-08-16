export const ROW_ACTION_IDS = [
  "download",
  "preview",
  "copy_link",
  "copy_view_link",
  "expire",
  "star",
  "tags",
  "copy_to",
  "delete",
] as const;

export type RowActionId = (typeof ROW_ACTION_IDS)[number];

/** Current inline toolbar — keep as default so existing installs look the same. */
export const DEFAULT_ROW_ACTIONS: RowActionId[] = [
  "download",
  "preview",
  "copy_link",
  "copy_view_link",
  "expire",
  "delete",
];

const ALLOWED = new Set<string>(ROW_ACTION_IDS);

export function isRowActionId(value: string): value is RowActionId {
  return ALLOWED.has(value);
}

/**
 * Parse D1 JSON / API payload into a de-duped list of known actions.
 * Empty array is valid (inline only shows More). Invalid input falls back to default.
 */
export function parseRowActions(raw: unknown): RowActionId[] {
  if (raw == null) return [...DEFAULT_ROW_ACTIONS];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [...DEFAULT_ROW_ACTIONS];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [...DEFAULT_ROW_ACTIONS];
    }
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_ROW_ACTIONS];
  const seen = new Set<RowActionId>();
  const out: RowActionId[] = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!isRowActionId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (parsed.length === 0) return [];
  if (out.length === 0) return [...DEFAULT_ROW_ACTIONS];
  return out;
}

export function serializeRowActions(ids: readonly RowActionId[]): string {
  return JSON.stringify(ids);
}

/** Toggle one action; persist in catalog order (simple settings UI). */
export function setRowActionEnabled(
  current: readonly string[],
  id: RowActionId,
  enabled: boolean,
): RowActionId[] {
  const selected = new Set(parseRowActions(current));
  if (enabled) selected.add(id);
  else selected.delete(id);
  return ROW_ACTION_IDS.filter((action) => selected.has(action));
}
