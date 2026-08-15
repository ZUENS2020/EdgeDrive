import { AdminApp } from "@/components/AdminApp";
import { getAuthMode } from "@/lib/cloudflare";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const settings = await getSettings();
  const authMode = await getAuthMode();
  return <AdminApp initialSettings={settings} authMode={authMode} />;
}
