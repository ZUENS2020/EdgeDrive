import { headers } from "next/headers";
import { renderPublicShare } from "@/server/v2/public-page";

export const dynamic = "force-dynamic";

export default async function PreviewSharePage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, requestHeaders] = await Promise.all([params, headers()]);
  return renderPublicShare(code, requestHeaders.get("cookie"));
}
