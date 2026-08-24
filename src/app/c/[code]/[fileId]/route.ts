import { getDB, getR2 } from "@/lib/cloudflare";
import { DomainError } from "@/server/v2/errors";
import { authorizePublicShare, incrementPublicDownload } from "@/server/v2/shares";
import { PUBLIC_FILE_HEADERS, serveV2File } from "@/server/v2/serve";

export const dynamic = "force-dynamic";

export async function OPTIONS() { return new Response(null, { status: 204, headers: PUBLIC_FILE_HEADERS }); }

async function handle(request: Request, context: { params: Promise<{ code: string; fileId: string }> }, headOnly: boolean) {
  try {
    const { code, fileId } = await context.params;
    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1";
    const [db, r2] = await Promise.all([getDB(), getR2()]);
    const authorized = await authorizePublicShare(db, {
      code,
      fileId,
      cookieHeader: request.headers.get("cookie"),
      intent: inline ? "preview" : "download",
    });
    if (!authorized.file) return new Response("Not found", { status: 404, headers: PUBLIC_FILE_HEADERS });
    if (!headOnly && !inline && !request.headers.get("range")) {
      await incrementPublicDownload(db, authorized.share.token, fileId);
    }
    return serveV2File({
      r2,
      storageKey: authorized.file.storage_key,
      name: authorized.file.name,
      mime: authorized.file.mime,
      inline,
      rangeHeader: request.headers.get("range"),
      headOnly,
    });
  } catch (error) {
    if (error instanceof DomainError) return new Response(error.code, { status: error.status, headers: PUBLIC_FILE_HEADERS });
    console.error(JSON.stringify({ message: "public content failed", error: error instanceof Error ? error.message : String(error) }));
    return new Response("Internal error", { status: 500, headers: PUBLIC_FILE_HEADERS });
  }
}

export async function GET(request: Request, context: { params: Promise<{ code: string; fileId: string }> }) { return handle(request, context, false); }
export async function HEAD(request: Request, context: { params: Promise<{ code: string; fileId: string }> }) { return handle(request, context, true); }
