import { NextResponse } from "next/server";
import { sharePatchSchema } from "@/lib/v2-contracts";
import { parseJson, withAdmin } from "@/server/v2/http";
import { deleteShare, patchShare } from "@/server/v2/shares";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  return withAdmin(request, async ({ db }) => {
    const { token } = await context.params;
    return NextResponse.json({ data: await patchShare(db, token, await parseJson(request, sharePatchSchema)) });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ token: string }> }) {
  return withAdmin(request, async ({ db }) => {
    const { token } = await context.params;
    await deleteShare(db, token);
    return new Response(null, { status: 204 });
  });
}
