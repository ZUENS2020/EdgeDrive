import { SettingsForm } from "@/components/SettingsForm";
import { SettingsShell } from "@/components/SettingsShell";
import { getAuthMode } from "@/lib/cloudflare";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const authMode = await getAuthMode();
  return (
    <SettingsShell settings={settings} showLogout={authMode !== "access"}>
      <div className="main" style={{ padding: "22px 28px 40px" }}>
        <div className="header" style={{ padding: "0 0 16px" }}>
          <h1>设置</h1>
        </div>
        <SettingsForm initial={settings} authMode={authMode} />
      </div>
    </SettingsShell>
  );
}
