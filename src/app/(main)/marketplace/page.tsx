import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MarketplaceView } from "@/components/user/marketplace/marketplace-view";

export default async function MarketplacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <MarketplaceView />;
}
