import { NextResponse } from "next/server";
import { fileScopeSchema } from "@/lib/v2-contracts";
import { listFiles } from "@/server/v2/files";
import { withAdmin } from "@/server/v2/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdmin(request, async ({ db, settings }) => {
    const url = new URL(request.url);
    const scope = fileScopeSchema.parse(url.searchParams.get("scope") || "all");
    const limit = Number(url.searchParams.get("limit") || settings.pageSize);
    const data = await listFiles(db, {
      scope,
      folderId: url.searchParams.get("folderId"),
      query: url.searchParams.get("q") || undefined,
      cursor: url.searchParams.get("cursor"),
      limit,
    });
    return NextResponse.json(data);
  });
}
