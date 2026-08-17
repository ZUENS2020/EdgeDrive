import { describe, expect, it } from "vitest";
import { adminMutationAllowed } from "./csrf";

function req(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("adminMutationAllowed", () => {
  it("allows GET/HEAD/OPTIONS regardless of Origin", () => {
    const headers = { origin: "https://evil.example" };
    expect(adminMutationAllowed(req("https://edgedrive.example/api/files", { method: "GET", headers }))).toBe(true);
    expect(adminMutationAllowed(req("https://edgedrive.example/api/files", { method: "HEAD", headers }))).toBe(true);
    expect(adminMutationAllowed(req("https://edgedrive.example/api/files", { method: "OPTIONS", headers }))).toBe(true);
  });

  it("allows mutating requests without Origin (curl / scheduled)", () => {
    expect(adminMutationAllowed(req("https://edgedrive.example/api/files/upload", { method: "POST" }))).toBe(true);
    expect(adminMutationAllowed(req("https://edgedrive.example/api/files", { method: "PATCH" }))).toBe(true);
  });

  it("rejects cross-site mutating Origin", () => {
    expect(
      adminMutationAllowed(
        req("https://edgedrive.example/api/files/upload", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
  });

  it("rejects Origin: null", () => {
    expect(
      adminMutationAllowed(
        req("https://edgedrive.example/api/files/upload", {
          method: "POST",
          headers: { origin: "null" },
        }),
      ),
    ).toBe(false);
  });

  it("allows same-host Origin even if proto differs (TLS termination)", () => {
    expect(
      adminMutationAllowed(
        req("http://edgedrive.example/api/files/upload", {
          method: "POST",
          headers: { origin: "https://edgedrive.example", host: "edgedrive.example" },
        }),
      ),
    ).toBe(true);
  });

  it("compares against forwarded Host used for public origin", () => {
    expect(
      adminMutationAllowed(
        req("http://localhost:8787/api/files/upload", {
          method: "POST",
          headers: {
            origin: "https://dlp.zuens2020.work",
            host: "localhost:8787",
            "x-forwarded-host": "dlp.zuens2020.work",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).toBe(true);
    expect(
      adminMutationAllowed(
        req("http://localhost:8787/api/files/upload", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            host: "localhost:8787",
            "x-forwarded-host": "dlp.zuens2020.work",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).toBe(false);
  });
});
