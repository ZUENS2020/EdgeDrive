import Link from "next/link";
import { SettingsForm } from "@/components/SettingsForm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="main" style={{ padding: "22px 28px 40px" }}>
      <div className="header" style={{ padding: "0 0 16px" }}>
        <h1>设置</h1>
        <div className="header-sp" />
        <Link className="btn" href="/admin">
          返回文件
        </Link>
      </div>
      <p style={{ color: "var(--text-3)", marginTop: 0 }}>
        站点名、描述、主色、每页条数、默认有效期保存在 D1 <code>settings</code> 表，可二次开发扩展。
      </p>
      <SettingsForm initial={settings} />
    </div>
  );
}
