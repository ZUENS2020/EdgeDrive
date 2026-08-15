import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/MobileNav";
import { requireAdminPage } from "@/lib/auth-guard";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await requireAdminPage();
  if (!gate.ok) redirect("/login");

  let brand = DEFAULTS.brand_color;
  let siteName = DEFAULTS.site_name;
  try {
    const settings = await getSettings();
    brand = settings.brand_color;
    siteName = settings.site_name;
  } catch {
    // ignore
  }

  return (
    <div className="admin-root" style={{ ["--brand" as string]: brand, flex: 1 }}>
      <MobileNav siteName={siteName} />
      {children}
    </div>
  );
}
