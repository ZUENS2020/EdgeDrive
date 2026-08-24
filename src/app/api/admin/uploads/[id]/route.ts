import { NextResponse } from "next/server";
import { parseJson, withAdmin } from "@/server/v2/http";
import { abortUpload, completeMultipart, uploadSingle } from "@/server/v2/uploads";
import { z } from "zod";

export const dynamic = "force-dynamic";

const completeSchema = z.object({
  parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1) })).min(1).max(10_000),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return withAdmin(request, async ({ db, r2 }) => {
    const { id } = await context.params;
    return NextResponse.json({ data: await uploadSingle(db, r2, id, request) });
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withAdmin(request, async ({ db, r2 }) => {
    const { id } = await context.params;
    const body = await parseJson(request, completeSchema);
    return NextResponse.json({ data: await completeMultipart(db, r2, id, body.parts) });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return withAdmin(request, async ({ db, r2 }) => {
    const { id } = await context.params;
    await abortUpload(db, r2, id);
    return new Response(null, { status: 204 });
  });
}
