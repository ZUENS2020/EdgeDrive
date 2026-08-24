import { NextResponse } from "next/server";
import { overview } from "@/server/v2/files";
import { withAdmin } from "@/server/v2/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdmin(request, async ({ db }) => NextResponse.json({ data: await overview(db) }));
}
