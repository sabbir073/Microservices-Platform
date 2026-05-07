import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { LocationsManagerView } from "@/components/admin/locations/locations-manager-view";

export default async function AdminLocationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "settings.view")) redirect("/admin");

  const canEdit = hasPermission(adminRole, "settings.edit");

  return <LocationsManagerView canEdit={canEdit} />;
}
