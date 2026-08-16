import { getR2 } from "./cloudflare";

export type CopyObjectResult =
  | { ok: true; skipped: boolean }
  | { ok: false; error: "miss" };

/**
 * Stream an R2 object from srcKey to dstKey (body is passed through, never buffered).
 * skipped=true when keys are identical (no I/O).
 */
export async function copyObject(
  srcKey: string,
  dstKey: string,
  opts?: { customMetadata?: Record<string, string> },
): Promise<CopyObjectResult> {
  if (srcKey === dstKey) return { ok: true, skipped: true };
  const r2 = await getR2();
  const obj = await r2.get(srcKey);
  if (!obj) return { ok: false, error: "miss" };
  await r2.put(dstKey, obj.body, {
    httpMetadata: obj.httpMetadata,
    customMetadata: opts?.customMetadata ?? obj.customMetadata,
  });
  return { ok: true, skipped: false };
}
