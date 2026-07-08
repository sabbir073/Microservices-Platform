import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { SplashAdminView } from "@/components/admin/splash/splash-admin-view";

export default async function SplashAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "banners.view")) redirect("/admin");
  return <SplashAdminView />;
}
