import { getDB } from "@/lib/cloudflare";
import { safeShareNext, serializeShareCookie } from "@/lib/share-password";
import { DomainError } from "@/server/v2/errors";
import { verifyPublicSharePassword } from "@/server/v2/shares";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const data = await request.formData();
  const fallback = `/s/${encodeURIComponent(code)}`;
  const next = safeShareNext(String(data.get("next") || ""), fallback);
  try {
    const result = await verifyPublicSharePassword(await getDB(), code, String(data.get("password") || ""));
    return new Response(null, {
      status: 303,
      headers: {
        Location: next,
        "Set-Cookie": serializeShareCookie({ token: result.token, value: result.cookie, secure: new URL(request.url).protocol === "https:" }),
      },
    });
  } catch (error) {
    const codeValue = error instanceof DomainError ? error.code : "unlock-failed";
    const separator = next.includes("?") ? "&" : "?";
    return new Response(null, { status: 303, headers: { Location: `${next}${separator}error=${encodeURIComponent(codeValue)}` } });
  }
}
