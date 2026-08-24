import { getDB } from "@/lib/cloudflare";
import { DomainError } from "./errors";
import { authorizePublicShare, getPublicShare } from "./shares";
import { PublicShareState, PublicShareView } from "@/components/public-share";

export async function renderPublicShare(code: string, cookieHeader: string | null) {
  const db = await getDB();
  try {
    const { share } = await authorizePublicShare(db, { code, cookieHeader, intent: "page" });
    return <PublicShareView share={share} unlocked />;
  } catch (error) {
    if (error instanceof DomainError && error.code === "share-password-required") {
      const share = await getPublicShare(db, code);
      return <PublicShareView share={share} unlocked={false} />;
    }
    if (error instanceof DomainError) return <PublicShareState title="Link unavailable" detail="This transfer cannot be opened." />;
    throw error;
  }
}
