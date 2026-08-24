import { NextResponse } from "next/server";
import { settingsPatchSchema } from "@/lib/v2-contracts";
import { parseJson, withAdmin } from "@/server/v2/http";
import { updateSettings } from "@/server/v2/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAdmin(request, async ({ settings }) => NextResponse.json({ data: settings }));
}

export async function PATCH(request: Request) {
  return withAdmin(request, async ({ db }) => NextResponse.json({ data: await updateSettings(db, await parseJson(request, settingsPatchSchema)) }));
}
