import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseLocale, t } from "@/lib/i18n";
import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { publicThemeVars } from "@/lib/themes";

export const dynamic = "force-dynamic";

export default async function Home() {
  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // D1 may be unavailable during first boot
  }
  const locale = parseLocale(settings.language);
  const vars = publicThemeVars(settings.theme_name);
  const themeVars = {
    "--brand": vars.brand,
    "--bg": vars.bg,
    "--text": vars.text,
    "--text-3": vars.text3,
    "--surface": vars.surface,
    "--line": vars.line,
  } as CSSProperties;

  return (
    <div className="home-wrap" style={themeVars}>
      <div className="home-card">
        <div className="brand" style={{ padding: "0 0 24px" }}>
          <div className="logo">{PRODUCT_SHORT}</div>
          <div>
            <div className="brand-name">{PRODUCT_NAME}</div>
            <div className="brand-sub">{t(locale, "product.tagline")}</div>
          </div>
        </div>
        <h1>{PRODUCT_NAME}</h1>
        <p>{t(locale, "product.description")}</p>
        <p>{t(locale, "product.dlHint")}</p>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground hover:no-underline">
          <Link href="/admin">
            {t(locale, "product.homeCta")}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
