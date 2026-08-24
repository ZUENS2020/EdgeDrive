import { NextResponse } from "next/server";
import { filePatchSchema } from "@/lib/v2-contracts";
import { patchFile } from "@/server/v2/files";
import { parseJson, withAdmin } from "@/server/v2/http";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withAdmin(request, async ({ db }) => {
    const { id } = await context.params;
    return NextResponse.json({ data: await patchFile(db, id, await parseJson(request, filePatchSchema)) });
  });
}
