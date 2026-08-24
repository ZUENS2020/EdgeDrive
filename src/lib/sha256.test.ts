import { describe, expect, it } from "vitest";
import { bytesToHex, normalizeSha256, sha256Hex } from "./sha256";

describe("sha256 helpers", () => {
  it("normalizes 64-char hex and rejects junk", () => {
    const hex = "a".repeat(64);
    expect(normalizeSha256(hex.toUpperCase())).toBe(hex);
    expect(normalizeSha256("zz")).toBeNull();
    expect(normalizeSha256(1)).toBeNull();
    expect(normalizeSha256("")).toBeNull();
  });

  it("hashes the empty buffer to the SHA-256 empty digest", async () => {
    const hex = await sha256Hex(new Uint8Array());
    expect(hex).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
  });
});
