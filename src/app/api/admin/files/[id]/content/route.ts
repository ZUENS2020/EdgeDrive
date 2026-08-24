import { getFileRecord } from "@/server/v2/files";
import { withAdmin } from "@/server/v2/http";
import { serveV2File } from "@/server/v2/serve";

export const dynamic = "force-dynamic";

async function handle(request: Request, context: { params: Promise<{ id: string }> }, headOnly: boolean) {
  return withAdmin(request, async ({ db, r2 }) => {
    const { id } = await context.params;
    const file = await getFileRecord(db, id);
    const url = new URL(request.url);
    return serveV2File({
      r2,
      storageKey: file.storage_key,
      name: file.name,
      mime: file.mime,
      inline: url.searchParams.get("inline") === "1",
      rangeHeader: request.headers.get("range"),
      headOnly,
    });
  });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return handle(request, context, false); }
export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) { return handle(request, context, true); }
