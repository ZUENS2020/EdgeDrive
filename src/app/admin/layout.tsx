import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/MobileNav";
import { requireAdminPage } from "@/lib/auth-guard";
import { PRODUCT_SHORT } from "@/lib/product";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await requireAdminPage();
  if (!gate.ok) redirect("/login");

  let brand = DEFAULTS.brand_color;
  try {
    const settings = await getSettings();
    brand = settings.brand_color;
  } catch {
    // ignore
  }

  return (
    <div className="admin-root" style={{ ["--brand" as string]: brand, flex: 1 }}>
      <MobileNav siteName={PRODUCT_SHORT} />
      {children}
    </div>
  );
}
