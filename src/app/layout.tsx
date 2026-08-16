import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_SC } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { htmlLang, parseLocale, t } from "@/lib/i18n";
import { PRODUCT_NAME } from "@/lib/product";
import { DEFAULTS, getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import "./globals.css";

const noto = Noto_Sans_SC({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

async function siteLocale() {
  try {
    return parseLocale((await getSettings()).language);
  } catch {
    return parseLocale(DEFAULTS.language);
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await siteLocale();
  return {
    title: PRODUCT_NAME,
    description: t(locale, "product.tagline"),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await siteLocale();
  return (
    <html lang={htmlLang(locale)} className={cn("h-full antialiased", noto.variable)}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
