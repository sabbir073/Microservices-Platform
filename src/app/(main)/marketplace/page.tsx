import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MarketplaceView } from "@/components/user/marketplace/marketplace-view";
import { getEffectiveFeatures } from "@/lib/packages";
import { FeatureLock } from "@/components/user/primitives/feature-lock";

export default async function MarketplacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enabled } = await getEffectiveFeatures(session.user.id);
  if (!enabled.has("marketplace")) return <FeatureLock title="Marketplace" />;

  return <MarketplaceView />;
}
