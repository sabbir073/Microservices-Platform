import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WatchAdsView } from "@/components/user/ads/watch-ads-view";

export default async function WatchAdsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <WatchAdsView />;
}
