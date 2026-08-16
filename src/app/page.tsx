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
import { resolveThemePalette } from "@/lib/themes";

export const dynamic = "force-dynamic";

export default async function Home() {
  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // D1 may be unavailable during first boot
  }
  const palette = resolveThemePalette(settings.theme_name);
  const p = palette as unknown as {
    primary: { main: string };
    background: { default: string; paper: string };
    text: { primary: string; secondary: string };
    divider: string;
  };
  const themeVars = {
    "--brand": p.primary.main,
    "--bg": p.background.default,
    "--text": p.text.primary,
    "--text-3": p.text.secondary,
    "--surface": p.background.paper,
    "--line": p.divider,
  };

  return (
    <div className="home-wrap" style={themeVars as React.CSSProperties}>
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
