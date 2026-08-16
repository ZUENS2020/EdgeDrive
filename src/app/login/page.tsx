import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";

export const dynamic = "force-dynamic";

export default function LoginPage() {
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
        <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          此站点由 Cloudflare Access 保护。请访问 <code>/admin</code>，由 Access 完成登录。
          <br />
          首次部署请先打开 <code>/admin</code> 完成 Access 配置引导。
        </p>
        <p style={{ marginTop: 18 }}>
          <Button asChild>
            <Link href="/admin">前往管理台</Link>
          </Button>
        </p>
      </div>
    </div>
  );
}
