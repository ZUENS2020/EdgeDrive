const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 32-byte high-entropy token, URL-safe base64 (43 chars). */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBase62(length: number): string {
  const n = Math.max(1, Math.min(32, Math.floor(length)));
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += BASE62[bytes[i]! % 62];
  return out;
}

export function isShortCode(value: string): boolean {
  return /^[0-9A-Za-z]{6,8}$/.test(value);
}

export async function isShortCodeTaken(db: D1Database, code: string): Promise<boolean> {
  const inLinks = await db
    .prepare("SELECT token FROM share_links WHERE short_code = ?")
    .bind(code)
    .first<{ token: string }>();
  if (inLinks) return true;
  const inModes = await db
    .prepare("SELECT token FROM share_short_codes WHERE code = ?")
    .bind(code)
    .first<{ token: string }>();
  return Boolean(inModes);
}

export async function allocateShortCode(db: D1Database): Promise<string> {
  for (const len of [6, 7, 8]) {
    for (let i = 0; i < 8; i++) {
      const code = randomBase62(len);
      if (!(await isShortCodeTaken(db, code))) return code;
    }
  }
  throw new Error("short-code-exhausted");
}
