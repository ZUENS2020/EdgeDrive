import { toNextJsHandler } from "better-auth/next-js";
import { createAuth } from "@/lib/auth";
import { getAuthMode, isAccessMode } from "@/lib/cloudflare";

async function handler(request: Request) {
  if (isAccessMode(await getAuthMode())) {
    return Response.json({ error: "access-mode" }, { status: 404 });
  }
  const auth = await createAuth(request);
  return auth.handler(request);
}

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);
export const dynamic = "force-dynamic";
