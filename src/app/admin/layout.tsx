import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createAuth } from "@/lib/auth";
import { getAuthMode } from "@/lib/cloudflare";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const mode = await getAuthMode();
  if (mode === "better-auth") {
    const auth = await createAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");
  }

  let brand = "#5e6ad2";
  try {
    brand = (await getSettings()).brand_color;
  } catch {
    // ignore
  }

  return <div style={{ ["--brand" as string]: brand, flex: 1 }}>{children}</div>;
}
