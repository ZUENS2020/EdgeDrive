import { FileManager } from "@/components/admin/FileManager";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const settings = await getSettings();
  return <FileManager initialSettings={settings} />;
}
