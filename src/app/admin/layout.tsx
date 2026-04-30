import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import { AdminLayoutShell } from "@/components/admin/layout-shell";
import { isAdmin, type UserRole } from "@/lib/rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Server-side redirect if not authenticated
  if (!session?.user) {
    redirect("/login");
  }

  // Server-side redirect if not admin (any admin role)
  const userRole = session.user.role as UserRole | undefined;
  if (!isAdmin(userRole)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Admin Sidebar (client component, manages its own collapse state) */}
      <AdminSidebar user={session.user} />

      {/* Client-side shell adjusts padding based on collapse state */}
      <AdminLayoutShell header={<AdminHeader user={session.user} />}>
        {children}
      </AdminLayoutShell>
    </div>
  );
}
