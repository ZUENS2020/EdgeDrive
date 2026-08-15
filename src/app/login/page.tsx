import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { getAuthMode } from "@/lib/cloudflare";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if ((await getAuthMode()) === "none") {
    redirect("/admin");
  }
  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // ignore
  }
  return (
    <Suspense>
      <LoginForm
        siteName={settings.site_name}
        subtitle={settings.login_subtitle}
        logoText={settings.logo_text}
        brandColor={settings.brand_color}
      />
    </Suspense>
  );
}
