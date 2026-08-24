import { NextResponse } from "next/server";
import { batchActionSchema } from "@/lib/v2-contracts";
import { batchFiles } from "@/server/v2/files";
import { parseJson, withAdmin } from "@/server/v2/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withAdmin(request, async ({ db, r2 }) => NextResponse.json({ data: await batchFiles(db, r2, await parseJson(request, batchActionSchema)) }));
}
