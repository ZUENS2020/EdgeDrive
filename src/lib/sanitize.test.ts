import { describe, expect, it } from "vitest";
import { looksLikeTraversal, parseRange, sanitizeKey } from "./sanitize";

describe("sanitizeKey", () => {
  it("1 accepts a normal nested key", () => {
    expect(sanitizeKey("docs/report.pdf")).toEqual({ value: "docs/report.pdf" });
  });

  it("2 rejects path traversal with ..", () => {
    expect(sanitizeKey("a/../b")).toEqual({ error: "path-traversal" });
  });

  it("3 rejects encoded traversal %2e%2e%2f", () => {
    expect(sanitizeKey("%2e%2e%2fsecret")).toEqual({ error: "encoded-traversal" });
  });

  it("4 rejects %2e in the raw key", () => {
    expect(sanitizeKey("foo%2ebar")).toEqual({ error: "encoded-traversal" });
  });

  it("5 rejects double-encoded traversal %252e", () => {
    expect(sanitizeKey("%252e%252e%252fetc")).toEqual({ error: "encoded-traversal" });
  });

  it("6 NFC-normalizes unicode", () => {
    const nfd = "cafe\u0301.txt";
    const nfc = "caf\u00e9.txt";
    expect(sanitizeKey(nfd)).toEqual({ value: nfc });
  });

  it("7 rejects keys longer than 1024 UTF-8 bytes", () => {
    expect(sanitizeKey("a".repeat(1024))).toEqual({ value: "a".repeat(1024) });
    expect(sanitizeKey("a".repeat(1025))).toEqual({ error: "too-long" });
    expect(sanitizeKey("中".repeat(342))).toEqual({ error: "too-long" });
  });

  it("8 rejects control characters", () => {
    expect(sanitizeKey("a\nb")).toEqual({ error: "control-chars" });
    expect(sanitizeKey("a\x00b")).toEqual({ error: "control-chars" });
  });

  it("9 rejects leading/trailing/double slashes", () => {
    expect(sanitizeKey("/abs")).toEqual({ error: "slash" });
    expect(sanitizeKey("dir/")).toEqual({ error: "slash" });
    expect(sanitizeKey("a//b")).toEqual({ error: "slash" });
  });

  it("10 rejects empty / whitespace", () => {
    expect(sanitizeKey("")).toEqual({ error: "empty" });
    expect(sanitizeKey("   ")).toEqual({ error: "empty" });
    expect(sanitizeKey(null)).toEqual({ error: "empty" });
  });
});

describe("looksLikeTraversal", () => {
  it("11 flags encoded dots in the raw URL", () => {
    expect(looksLikeTraversal("https://x/dl/foo%2e%2e/bar", "/dl/foo../bar")).toBe(true);
    expect(looksLikeTraversal("https://x/dl/ok.txt", "/dl/ok.txt")).toBe(false);
  });
});

describe("parseRange", () => {
  it("12 suffix range bytes=-N", () => {
    expect(parseRange("bytes=-2", 10)).toEqual({ start: 8, end: 9, length: 2 });
  });

  it("13 rejects inverted and unsatisfiable ranges", () => {
    expect(parseRange("bytes=5-1", 10)).toBeNull();
    expect(parseRange("bytes=10-12", 10)).toBeNull();
    expect(parseRange("bytes=abc-1", 10)).toBeNull();
    expect(parseRange(null, 10)).toBeNull();
  });

  it("14 clamps end past size and allows first-byte", () => {
    expect(parseRange("bytes=0-99", 10)).toEqual({ start: 0, end: 9, length: 10 });
    expect(parseRange("bytes=0-0", 10)).toEqual({ start: 0, end: 0, length: 1 });
    expect(parseRange("bytes=2-", 10)).toEqual({ start: 2, end: 9, length: 8 });
  });
});
