import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getDB } from "@/lib/cloudflare";
import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let enabled = true;
  try {
    const db = await getDB();
    const s = await getSettings(db);
    enabled = s.access_enabled;
  } catch {
    // DB 不可用时按已启用处理（fail-closed 保守）
  }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="logo">{PRODUCT_SHORT}</div>
          <div>
            <div className="brand-name">{PRODUCT_NAME}</div>
            <div className="brand-sub">受 Cloudflare Access 保护</div>
          </div>
        </div>
        {enabled ? (
          <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            此站点由 Cloudflare Access 保护。请访问 <code>/admin</code>，由 Access 完成登录。
          </p>
        ) : (
          <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            首次部署：请打开 <code>/admin</code> 完成 Access 配置引导（填写 Team 与 AUD 后启用保护）。
          </p>
        )}
        <p style={{ marginTop: 18 }}>
          <Button asChild>
            <Link href="/admin">前往管理台</Link>
          </Button>
        </p>
      </div>
    </div>
  );
}
