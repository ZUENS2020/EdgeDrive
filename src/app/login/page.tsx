import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getDB } from "@/lib/cloudflare";
import { parseLocale, t } from "@/lib/i18n";
import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import { DEFAULTS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let enabled = true;
  let locale = parseLocale(DEFAULTS.language);
  try {
    const db = await getDB();
    const s = await getSettings(db);
    enabled = s.access_enabled;
    locale = parseLocale(s.language);
  } catch {
    // Fail-closed: treat Access as enabled when DB is unavailable.
  }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="logo">{PRODUCT_SHORT}</div>
          <div>
            <div className="brand-name">{PRODUCT_NAME}</div>
            <div className="brand-sub">{t(locale, "login.protectedSub")}</div>
          </div>
        </div>
        {enabled ? (
          <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            {t(locale, "login.enabledBody")}
          </p>
        ) : (
          <p style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            {t(locale, "login.setupBody")}
          </p>
        )}
        <p style={{ marginTop: 18 }}>
          <Button asChild>
            <Link href="/admin">{t(locale, "login.goAdmin")}</Link>
          </Button>
        </p>
      </div>
    </div>
  );
}
