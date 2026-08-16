import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PRODUCT_DESCRIPTION,
  PRODUCT_DL_HINT,
  PRODUCT_HOME_CTA,
  PRODUCT_NAME,
  PRODUCT_SHORT,
  PRODUCT_TAGLINE,
} from "@/lib/product";
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
  const t = publicThemeVars(settings.theme_name);
  const themeVars = {
    "--brand": t.brand,
    "--bg": t.bg,
    "--text": t.text,
    "--text-3": t.text3,
    "--surface": t.surface,
    "--line": t.line,
  } as CSSProperties;

  return (
    <div className="home-wrap" style={themeVars}>
      <div className="home-card">
        <div className="brand" style={{ padding: "0 0 24px" }}>
          <div className="logo">{PRODUCT_SHORT}</div>
          <div>
            <div className="brand-name">{PRODUCT_NAME}</div>
            <div className="brand-sub">{PRODUCT_TAGLINE}</div>
          </div>
        </div>
        <h1>{PRODUCT_NAME}</h1>
        <p>{PRODUCT_DESCRIPTION}</p>
        <p>{PRODUCT_DL_HINT}</p>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground hover:no-underline">
          <Link href="/admin">
            {PRODUCT_HOME_CTA}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
