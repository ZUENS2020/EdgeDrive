import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PRODUCT_NAME } from "@/lib/product";
import "./globals.css";

export const metadata: Metadata = { title: PRODUCT_NAME, description: "Private object storage on Cloudflare" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
