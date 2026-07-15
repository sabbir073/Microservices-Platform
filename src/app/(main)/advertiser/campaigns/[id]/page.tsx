import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEffectiveFeatures } from "@/lib/packages";
import { FeatureLock } from "@/components/user/primitives/feature-lock";
import { CampaignDetailView } from "@/components/user/advertiser/campaign-detail-view";

export default async function AdvertiserCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enabled } = await getEffectiveFeatures(session.user.id);
  if (!enabled.has("advertiser")) return <FeatureLock title="Advertiser" />;

  const { id } = await params;
  return <CampaignDetailView campaignId={id} />;
}
