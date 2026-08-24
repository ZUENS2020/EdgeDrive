import { NextResponse } from "next/server";
import { shareCreateSchema } from "@/lib/v2-contracts";
import { parseJson, withAdmin } from "@/server/v2/http";
import { createShare, listShares } from "@/server/v2/shares";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdmin(request, async ({ db, settings }) => {
    const url = new URL(request.url);
    return NextResponse.json(await listShares(db, {
      query: url.searchParams.get("q") || undefined,
      cursor: url.searchParams.get("cursor"),
      limit: Number(url.searchParams.get("limit") || settings.pageSize),
    }));
  });
}

export async function POST(request: Request) {
  return withAdmin(request, async ({ db }) => {
    const body = await parseJson(request, shareCreateSchema);
    return NextResponse.json({ data: await createShare(db, body) }, { status: 201 });
  });
}
