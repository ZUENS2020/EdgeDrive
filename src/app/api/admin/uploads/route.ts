import { NextResponse } from "next/server";
import { prepareUploadSchema } from "@/lib/v2-contracts";
import { parseJson, withAdmin } from "@/server/v2/http";
import { prepareUpload } from "@/server/v2/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withAdmin(request, async ({ db, r2, settings }) => {
    const input = await parseJson(request, prepareUploadSchema);
    if (input.expiresAt === undefined && settings.defaultExpires !== "permanent") {
      const unit = settings.defaultExpires.endsWith("h") ? 3600_000 : 86400_000;
      const amount = Number.parseInt(settings.defaultExpires, 10);
      input.expiresAt = new Date(Date.now() + amount * unit).toISOString();
    }
    return NextResponse.json({ data: await prepareUpload(db, r2, input) });
  });
}
