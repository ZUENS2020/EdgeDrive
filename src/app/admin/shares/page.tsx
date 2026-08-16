import { Suspense } from "react";
import { ShareManager } from "@/components/admin/ShareManager";

export const dynamic = "force-dynamic";

export default function SharesPage() {
  return (
    <Suspense>
      <ShareManager />
    </Suspense>
  );
}
