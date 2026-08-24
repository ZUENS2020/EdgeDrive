import { Suspense } from "react";
import { FileManagerV2 } from "@/components/admin-v2/file-manager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  return <Suspense><FileManagerV2 /></Suspense>;
}
