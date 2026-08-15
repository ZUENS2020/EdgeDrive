export type ExpireInput = {
  permanent?: boolean;
  expireNow?: boolean;
  hours?: number;
  days?: number;
  expires?: string;
};

export function parseExpireInput(input: ExpireInput): {
  value: string | null;
  error?: string;
} {
  if (input.permanent) return { value: null };
  if (input.expireNow) return { value: new Date(Date.now() - 60_000).toISOString() };

  if (input.expires) {
    const d = new Date(input.expires);
    if (Number.isNaN(d.getTime())) return { value: null, error: "invalid expires" };
    return { value: d.toISOString() };
  }

  if (input.hours != null) {
    const n = Number(input.hours);
    if (!Number.isFinite(n) || n <= 0) return { value: null, error: "hours must be > 0" };
    if (n > 24 * 365 * 10) return { value: null, error: "hours too large" };
    return { value: new Date(Date.now() + n * 3600e3).toISOString() };
  }

  if (input.days != null) {
    const n = Number(input.days);
    if (!Number.isFinite(n) || n <= 0) return { value: null, error: "days must be > 0" };
    if (n > 365 * 10) return { value: null, error: "days too large" };
    return { value: new Date(Date.now() + n * 86400e3).toISOString() };
  }

  return { value: null };
}

export function parseDefaultExpires(raw: string | undefined): ExpireInput {
  const v = (raw || "24h").trim().toLowerCase();
  if (v === "permanent" || v === "none" || v === "0") return { permanent: true };
  const m = /^(\d+(?:\.\d+)?)(h|d|hours?|days?)$/.exec(v);
  if (!m) return { hours: 24 };
  const n = Number(m[1]);
  if (m[2].startsWith("d")) return { days: n };
  return { hours: n };
}

export function expireFromSearchParams(params: URLSearchParams): ExpireInput {
  if (params.get("permanent") === "1") return { permanent: true };
  if (params.get("expireNow") === "1") return { expireNow: true };
  const expires = params.get("expires") || undefined;
  const hoursRaw = params.get("hours");
  const daysRaw = params.get("days");
  return {
    expires,
    hours: hoursRaw != null && hoursRaw !== "" ? Number(hoursRaw) : undefined,
    days: daysRaw != null && daysRaw !== "" ? Number(daysRaw) : undefined,
  };
}
