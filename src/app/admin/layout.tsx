import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import type { ReactNode } from "react";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { SetupProviders } from "@/components/admin/SetupProviders";
import { requireAdminPage } from "@/lib/auth-guard";
import { getSetupToken } from "@/lib/cloudflare";
import { parseLocale, t } from "@/lib/i18n";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await requireAdminPage();
  if (gate.setup) {
    let locale = parseLocale(DEFAULTS.language);
    try {
      locale = parseLocale((await getSettings()).language);
    } catch {
      // ignore
    }
    return <SetupProviders tokenRequired={Boolean(await getSetupToken())} locale={locale} />;
  }
  if (!gate.ok) {
    let locale = parseLocale(DEFAULTS.language);
    try {
      locale = parseLocale((await getSettings()).language);
    } catch {
      // ignore
    }
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand" style={{ padding: "0 0 18px" }}>
            <div className="logo">{PRODUCT_SHORT}</div>
            <div>
              <div className="brand-name">{PRODUCT_NAME}</div>
              <div className="brand-sub">{t(locale, "login.unauthSub")}</div>
            </div>
          </div>
          <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            {t(locale, "login.unauthBody")}
          </p>
        </div>
      </div>
    );
  }

  let appearance = {
    theme_name: DEFAULTS.theme_name,
  };
  let siteSettings = DEFAULTS;
  try {
    const settings = await getSettings();
    appearance = {
      theme_name: settings.theme_name,
    };
    siteSettings = settings;
  } catch {
    // ignore
  }

  return (
    <AdminProviders initial={appearance} initialSettings={siteSettings}>
      {children}
    </AdminProviders>
  );
}
