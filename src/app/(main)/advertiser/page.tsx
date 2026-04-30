import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdvertiserDashboard } from "@/components/user/advertiser/advertiser-dashboard";

export default async function AdvertiserPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <AdvertiserDashboard />;
}
