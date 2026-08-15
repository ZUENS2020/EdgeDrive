import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/admin">
              进入管理后台
              <ArrowRight />
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1 text-[var(--text-4)] text-xs">
            <Download className="size-3.5" />
            AUTH_MODE=better-auth 走登录；AUTH_MODE=none 时请用 Cloudflare Access 保护{" "}
            <code>/admin*</code>
          </span>
        </div>
      </div>
    </div>
  );
}
