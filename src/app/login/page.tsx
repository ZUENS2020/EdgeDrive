import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { getAuthMode } from "@/lib/cloudflare";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if ((await getAuthMode()) === "none") {
    redirect("/admin");
  }
  let siteName = "ZUENS DL";
  try {
    siteName = (await getSettings()).site_name;
  } catch {
    // ignore
  }
  return (
    <Suspense>
      <LoginForm siteName={siteName} />
    </Suspense>
  );
}
