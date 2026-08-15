import { UsageView } from "@/components/UsageView";
import { SettingsShell } from "@/components/SettingsShell";
import { getAuthMode } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const authMode = await getAuthMode();
  return (
    <SettingsShell showLogout={authMode !== "access"}>
      <div className="main" style={{ padding: "22px 28px 40px" }}>
        <UsageView />
      </div>
    </SettingsShell>
  );
}
