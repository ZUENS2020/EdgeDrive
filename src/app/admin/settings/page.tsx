import { SettingsView } from "@/components/admin/SettingsView";
import { ensureCronSecret } from "@/lib/app-config";
import { getDB } from "@/lib/cloudflare";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = await getDB();
  await ensureCronSecret(db);
  const settings = await getSettings(db);
  return <SettingsView initial={settings} />;
}
