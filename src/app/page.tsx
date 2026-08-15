import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  let settings = {
    site_name: "ZUENS DL",
    site_description: "下载资源管理平台",
    brand_color: "#5e6ad2",
  };
  try {
    settings = await getSettings();
  } catch {
    // D1 may be unavailable during first boot / static analysis
  }

  return (
    <div className="home-wrap" style={{ ["--brand" as string]: settings.brand_color }}>
      <div className="home-card">
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="logo">{settings.site_name.slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="brand-name">{settings.site_name}</div>
            <div className="brand-sub">Download platform</div>
          </div>
        </div>
        <h1>{settings.site_name}</h1>
        <p>{settings.site_description}</p>
        <p>
          公开直链格式：<code>/dl/文件路径</code>
        </p>
        <p>
          管理后台：<Link href="/admin">/admin</Link>
          <span style={{ color: "var(--text-4)" }}>
            {" "}
            · AUTH_MODE=better-auth 走登录；AUTH_MODE=none 时请用 Cloudflare Access 保护{" "}
            <code>/admin*</code>
          </span>
        </p>
      </div>
    </div>
  );
}
