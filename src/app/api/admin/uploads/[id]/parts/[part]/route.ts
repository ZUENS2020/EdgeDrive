import { NextResponse } from "next/server";
import { withAdmin } from "@/server/v2/http";
import { uploadPart } from "@/server/v2/uploads";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string; part: string }> }) {
  return withAdmin(request, async ({ db, r2 }) => {
    const { id, part } = await context.params;
    const uploaded = await uploadPart(db, r2, id, Number(part), request);
    return NextResponse.json({ data: uploaded });
  });
}
