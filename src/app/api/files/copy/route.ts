import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { copyErrorMessage, copyResponseStatus, parseCopyBody, withCopyMessages } from "@/lib/copy";
import { copyFiles } from "@/lib/store";

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
  const parsed = parseCopyBody(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: parsed.error, message: copyErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await copyFiles(parsed.ids, parsed.target_path);
    const results = withCopyMessages(result.results);
    const failed = results.filter((r) => !r.ok).length;
    const status = copyResponseStatus(result.copied, result.results);
    const payload = {
      copied: result.copied,
      failed,
      results,
    };
    if (status !== 200) {
      const first = results.find((r) => !r.ok);
      return NextResponse.json(
        {
          ...payload,
          error: first?.error || "copy-failed",
          message: first && "message" in first ? first.message : copyErrorMessage(first?.error),
        },
        { status },
      );
    }
    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    const msg = String((err as Error).message || err);
    const status = msg === "folder-not-found" || msg === "file-exists" ? 409 : 400;
    return NextResponse.json({ error: msg, message: copyErrorMessage(msg) }, { status });
  }
}
