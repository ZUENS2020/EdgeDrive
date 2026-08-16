import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { expireFromSearchParams, parseDefaultExpires, parseExpireInput } from "@/lib/expires";
import { parseInstantCheckBody } from "@/lib/instant";
import { guessMime } from "@/lib/sanitize";
import { getSettings } from "@/lib/settings";
import { instantCopy } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = parseInstantCheckBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const settings = await getSettings();
  const url = new URL(request.url);
  const expireInput = expireFromSearchParams(url.searchParams);
  const obj = body as Record<string, unknown>;
  const merged = {
    ...expireInput,
    permanent: expireInput.permanent || obj.permanent === true,
    expireNow: expireInput.expireNow || obj.expireNow === true,
    expires: expireInput.expires || (typeof obj.expires === "string" ? obj.expires : undefined),
    hours: expireInput.hours || (typeof obj.hours === "number" ? obj.hours : undefined),
    days: expireInput.days || (typeof obj.days === "number" ? obj.days : undefined),
  };
  const hasExplicit =
    merged.permanent || merged.expireNow || merged.expires || merged.hours || merged.days;
  const expires = parseExpireInput(hasExplicit ? merged : parseDefaultExpires(settings.default_expires));
  if (expires.error) return NextResponse.json({ error: expires.error }, { status: 400 });

  const result = await instantCopy({
    sha256: parsed.sha256,
    name: parsed.name,
    path: parsed.path,
    expires: expires.value,
    mime: guessMime(parsed.name),
  });
  if ("error" in result) {
    if (result.error === "miss") return NextResponse.json({ hit: false });
    const status = result.error === "file-exists" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({
    hit: true,
    instant: true,
    id: result.id,
    key: result.key,
    size: result.size,
    mime: result.mime,
    url: `/dl/${result.key.split("/").map(encodeURIComponent).join("/")}`,
    expires: expires.value,
  });
}
