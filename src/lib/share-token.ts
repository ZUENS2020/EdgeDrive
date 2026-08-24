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
  return /^[0-9A-Za-z]{10}$/.test(value);
}
