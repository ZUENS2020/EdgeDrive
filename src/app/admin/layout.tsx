import { Suspense, type ReactNode } from "react";
import { Cloud } from "lucide-react";
import { AdminProvider } from "@/components/admin-v2/admin-provider";
import { AdminShell } from "@/components/admin-v2/admin-shell";
import { SetupPanelV2 } from "@/components/admin-v2/setup-panel";
import { requireAdminPage } from "@/lib/auth-guard";
import { getDB, getSetupToken } from "@/lib/cloudflare";
import { readSettings } from "@/server/v2/settings";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await requireAdminPage();
  if (gate.setup) {
    return <SetupPanelV2 tokenRequired={Boolean(await getSetupToken())} />;
  }
  if (!gate.ok) {
    return (
      <main className="setup-shell"><section className="setup-card"><div className="setup-brand"><Cloud size={21} /><strong>EDGEDRIVE</strong><span>V2</span></div><p className="eyebrow">ACCESS REQUIRED</p><h1>Authentication needed</h1><p className="setup-intro">Open this application through the configured Cloudflare Access policy, then return here.</p></section></main>
    );
  }
  const settings = await readSettings(await getDB());
  return (
    <AdminProvider settings={settings}>
      <Suspense><AdminShell>{children}</AdminShell></Suspense>
    </AdminProvider>
  );
}
