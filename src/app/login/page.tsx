import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { SetupForm } from "@/components/SetupForm";
import { hasAdmin } from "@/lib/app-config";
import { getAuthMode, getDB, isAccessMode } from "@/lib/cloudflare";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const mode = await getAuthMode();
  if (isAccessMode(mode)) {
    // access 模式没有密码登录——显示提示（不跳 /admin——避免与 admin 守卫互跳成环）
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand" style={{ padding: "0 0 18px" }}>
            <div className="logo">E</div>
            <div>
              <div className="brand-name">EdgeDrive</div>
              <div className="brand-sub">受 Cloudflare Access 保护</div>
            </div>
          </div>
          <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            此站点通过 Cloudflare Access 验证身份。
            <br />
            请直接访问 <code>/admin</code>，由 Access 完成登录。
          </p>
        </div>
      </div>
    );
  }

  let settings = DEFAULTS;
  let setup = false;
  try {
    const db = await getDB();
    settings = await getSettings(db);
    setup = !(await hasAdmin(db));
  } catch {
    // ignore
  }

  return (
    <Suspense>{setup ? <SetupForm brandColor={settings.brand_color} /> : <LoginForm brandColor={settings.brand_color} />}</Suspense>
  );
}
