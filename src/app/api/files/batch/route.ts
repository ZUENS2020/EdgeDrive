import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { parseExpireInput, type ExpireInput } from "@/lib/expires";
import { deleteFiles, setFileExpires } from "@/lib/store";

export const dynamic = "force-dynamic";

type BatchBody = {
  ids?: string[];
  action?: "expire" | "expireNow" | "permanent" | "delete";
} & ExpireInput;

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let body: BatchBody;
  try {
    body = (await request.json()) as BatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ids = (body.ids || []).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: "need ids" }, { status: 400 });
  const action = body.action || "expire";

  if (action === "delete") {
    const result = await deleteFiles(ids);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "permanent") {
    await setFileExpires(ids, null);
    return NextResponse.json({ ok: true, expires: null });
  }

  if (action === "expireNow") {
    const parsed = parseExpireInput({ expireNow: true });
    await setFileExpires(ids, parsed.value);
    return NextResponse.json({ ok: true, expires: parsed.value });
  }

  const parsed = parseExpireInput(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await setFileExpires(ids, parsed.value);
  return NextResponse.json({ ok: true, expires: parsed.value });
}
