import { NextResponse } from "next/server";
import { z } from "zod";
import { createFolder, listDeletedFolders, listFolderTree } from "@/server/v2/files";
import { parseJson, withAdmin } from "@/server/v2/http";

export const dynamic = "force-dynamic";

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentId: z.string().uuid().nullable().default(null),
});

export async function GET(request: Request) {
  return withAdmin(request, async ({ db }) => {
    const trash = new URL(request.url).searchParams.get("trash") === "1";
    return NextResponse.json({ data: trash ? await listDeletedFolders(db) : await listFolderTree(db) });
  });
}

export async function POST(request: Request) {
  return withAdmin(request, async ({ db }) => {
    const body = await parseJson(request, createFolderSchema);
    return NextResponse.json({ data: await createFolder(db, body.name, body.parentId) }, { status: 201 });
  });
}
