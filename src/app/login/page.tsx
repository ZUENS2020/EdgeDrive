import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { SetupForm } from "@/components/SetupForm";
import { hasAdmin } from "@/lib/app-config";
import { getAuthMode, getDB, isAccessMode } from "@/lib/cloudflare";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const mode = await getAuthMode();
  if (isAccessMode(mode)) redirect("/admin");

  let settings = DEFAULTS;
  let setup = false;
  try {
    const db = await getDB();
    settings = await getSettings(db);
    setup = !(await hasAdmin(db));
  } catch {
    // ignore
  }

  return (
    <Suspense>{setup ? <SetupForm brandColor={settings.brand_color} /> : <LoginForm brandColor={settings.brand_color} />}</Suspense>
  );
}
