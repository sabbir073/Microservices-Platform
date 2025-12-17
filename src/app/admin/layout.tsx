import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
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
    <div className="min-h-screen bg-gray-950">
      {/* Admin Sidebar */}
      <AdminSidebar user={session.user} />

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Admin Header */}
        <AdminHeader user={session.user} />

        {/* Page Content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
