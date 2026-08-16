import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { SetupProviders } from "@/components/admin/SetupProviders";
import { requireAdminPage } from "@/lib/auth-guard";
import { getSetupToken } from "@/lib/cloudflare";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await requireAdminPage();
  if (gate.setup) {
    return <SetupProviders tokenRequired={Boolean(await getSetupToken())} />;
  }
  if (!gate.ok) redirect("/login");

  let brand = DEFAULTS.brand_color;
  try {
    const settings = await getSettings();
    brand = settings.brand_color;
  } catch {
    // ignore
  }

  return <AdminProviders brandColor={brand}>{children}</AdminProviders>;
}
