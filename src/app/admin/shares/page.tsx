import { Suspense } from "react";
import { ShareManagerV2 } from "@/components/admin-v2/share-manager";

export const dynamic = "force-dynamic";

export default function SharesPage() {
  return (
    <Suspense>
      <ShareManagerV2 />
    </Suspense>
  );
}
