import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { logoGlyph } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let settings = DEFAULTS;
  try {
    settings = await getSettings();
  } catch {
    // D1 may be unavailable during first boot
  }

  return (
    <div className="home-wrap" style={{ ["--brand" as string]: settings.brand_color }}>
      <div className="home-card">
        <div className="brand" style={{ padding: "0 0 24px" }}>
          <div className="logo">{logoGlyph(settings)}</div>
          <div>
            <div className="brand-name">{settings.site_name}</div>
            {settings.home_kicker ? <div className="brand-sub">{settings.home_kicker}</div> : null}
          </div>
        </div>
        <h1>{settings.site_name}</h1>
        {settings.site_description ? <p>{settings.site_description}</p> : null}
        {settings.home_dl_hint ? <p>{settings.home_dl_hint}</p> : null}
        {settings.show_admin_link ? (
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground hover:no-underline">
            <Link href="/admin">
              {settings.home_cta}
              <ArrowRight />
            </Link>
          </Button>
        ) : null}
        {settings.footer_note ? <p className="home-foot">{settings.footer_note}</p> : null}
      </div>
    </div>
  );
}
