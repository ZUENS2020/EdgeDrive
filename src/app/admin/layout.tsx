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
  if (!gate.ok) {
    // 已启用 Access 但未带有效 JWT：显示 401 页（不跳 /login——避免死循环）
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand" style={{ padding: "0 0 18px" }}>
            <div className="logo">ED</div>
            <div>
              <div className="brand-name">EdgeDrive</div>
              <div className="brand-sub">未认证</div>
            </div>
          </div>
          <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            此站点由 Cloudflare Access 保护，但当前请求未携带有效的 Access 凭证（401）。
            <br />
            请确认 Cloudflare Access 已正确保护此路径（<code>/admin*</code>），并通过 Access 完成登录。
          </p>
        </div>
      </div>
    );
  }

  let brand = DEFAULTS.brand_color;
  try {
    const settings = await getSettings();
    brand = settings.brand_color;
  } catch {
    // ignore
  }

  return <AdminProviders brandColor={brand}>{children}</AdminProviders>;
}
