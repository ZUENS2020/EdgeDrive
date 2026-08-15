import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { getAuthMode, getCfEnv, isAccessMode, listOAuthProviders } from "@/lib/cloudflare";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const mode = await getAuthMode();
  if (isAccessMode(mode)) redirect("/admin");

  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // ignore
  }
  let oauthProviders: Array<"github" | "google"> = [];
  try {
    oauthProviders = listOAuthProviders(await getCfEnv());
  } catch {
    oauthProviders = listOAuthProviders();
  }

  return (
    <Suspense>
      <LoginForm
        siteName={settings.site_name}
        subtitle={settings.login_subtitle}
        logoText={settings.logo_text}
        brandColor={settings.brand_color}
        mode={mode}
        oauthProviders={oauthProviders}
      />
    </Suspense>
  );
}
