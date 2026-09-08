import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { requireAdmin } from "@/lib/auth-guard";
import { getDB, getR2 } from "@/lib/cloudflare";
import type { ApiErrorBody } from "@/lib/v2-contracts";
import { DomainError } from "./errors";
import { readSettings } from "./settings";

export type RequestContext = {
  request: Request;
  db: D1Database;
  r2: R2Bucket;
  settings: Awaited<ReturnType<typeof readSettings>>;
};

export function apiError(code: string, status: number, field?: string): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message: code, field } }, { status });
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new DomainError("invalid-json", 400);
  }
  return schema.parse(raw);
}

export async function withAdmin(
  request: Request,
  handler: (ctx: RequestContext) => Promise<Response>,
): Promise<Response> {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;
    const db = await getDB();
    const [r2, settings] = await Promise.all([getR2(), readSettings(db)]);
    return await handler({ request, db, r2, settings });
  } catch (error) {
    if (error instanceof DomainError) return apiError(error.code, error.status, error.field);
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return apiError(issue?.message || "invalid-input", 400, issue?.path.join(".") || undefined);
    }
    console.error(JSON.stringify({
      message: "admin request failed",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    return apiError("internal-error", 500);
  }
}
