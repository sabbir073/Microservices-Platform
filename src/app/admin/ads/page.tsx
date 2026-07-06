import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { AdManagerView } from "@/components/admin/ads/ad-manager-view";

export default async function AdsAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "ads.view")) redirect("/admin");

  return <AdManagerView canManage={hasPermission(adminRole, "ads.manage")} />;
}
