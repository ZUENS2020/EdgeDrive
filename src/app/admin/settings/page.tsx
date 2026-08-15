import { SettingsForm } from "@/components/SettingsForm";
import { SettingsShell } from "@/components/SettingsShell";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <SettingsShell settings={settings}>
      <div className="main" style={{ padding: "22px 28px 40px" }}>
        <div className="header" style={{ padding: "0 0 16px" }}>
          <h1>设置</h1>
        </div>
        <p style={{ color: "var(--text-3)", marginTop: 0 }}>
          首页、登录页和管理侧栏的文案都在这里改，保存后立即生效。
        </p>
        <SettingsForm initial={settings} />
      </div>
    </SettingsShell>
  );
}
