import { AdminApp } from "@/components/AdminApp";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const settings = await getSettings();
  return <AdminApp initialSettings={settings} />;
}
