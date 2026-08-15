import { toNextJsHandler } from "better-auth/next-js";
import { createAuth } from "@/lib/auth";
import { getAuthMode } from "@/lib/cloudflare";

async function handler(request: Request) {
  if ((await getAuthMode()) === "none") {
    return Response.json({ error: "AUTH_MODE=none" }, { status: 404 });
  }
  const auth = await createAuth();
  return auth.handler(request);
}

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);
export const dynamic = "force-dynamic";
