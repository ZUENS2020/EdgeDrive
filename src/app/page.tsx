import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  let settings = {
    site_name: "ZUENS DL",
    site_description: "下载资源管理平台",
    brand_color: "#171717",
  };
  try {
    settings = await getSettings();
  } catch {
    // D1 may be unavailable during first boot / static analysis
  }

  return (
    <div className="home-wrap" style={{ ["--brand" as string]: settings.brand_color }}>
      <div className="home-card">
        <div className="brand" style={{ padding: "0 0 24px" }}>
          <div className="logo">{settings.site_name.slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="brand-name">{settings.site_name}</div>
            <div className="brand-sub">直链下载</div>
          </div>
        </div>
        <h1>{settings.site_name}</h1>
        <p>{settings.site_description}</p>
        <p>
          公开地址：<code>/dl/文件路径</code>
        </p>
        <Button asChild>
          <Link href="/admin">
            管理后台
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
