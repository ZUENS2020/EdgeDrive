import { NextResponse } from "next/server";
import { z } from "zod";
import { renameFolder, restoreFolder, trashFolder } from "@/server/v2/files";
import { parseJson, withAdmin } from "@/server/v2/http";

export const dynamic = "force-dynamic";

const folderPatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: z.string().trim().min(1).max(255) }),
  z.object({ action: z.literal("restore") }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withAdmin(request, async ({ db }) => {
    const { id } = await context.params;
    const body = await parseJson(request, folderPatchSchema);
    if (body.action === "rename") await renameFolder(db, id, body.name);
    else await restoreFolder(db, id);
    return NextResponse.json({ data: { id } });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return withAdmin(request, async ({ db }) => {
    const { id } = await context.params;
    await trashFolder(db, id);
    return new Response(null, { status: 204 });
  });
}
