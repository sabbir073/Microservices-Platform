import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Shield,
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  hasPermission,
  type UserRole,
  ADMIN_ROLES,
  ROLE_CONFIG,
  ROLE_PERMISSIONS,
} from "@/lib/rbac";
import { AdminRoleForm } from "../_components/AdminRoleForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "admins.manage")) {
    redirect("/admin/access");
  }

  const { id } = await params;

  const admin = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!admin) {
    notFound();
  }

  // Check if this is an admin user
  if (!ADMIN_ROLES.includes(admin.role as UserRole)) {
    notFound();
  }

  const roleConfig = ROLE_CONFIG[admin.role as UserRole];
  const permissions = ROLE_PERMISSIONS[admin.role as UserRole] || [];

  // Check if current user can modify this admin
  const isSelf = session.user.id === admin.id;
  const canModify = adminRole === "SUPER_ADMIN" && !isSelf;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/access"
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Admin</h1>
          <p className="text-gray-400">View and update admin permissions</p>
        </div>
      </div>

      {/* Self Warning */}
      {isSelf && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <p className="text-amber-400">You cannot modify your own admin role</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Admin Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mb-4">
                {admin.name?.charAt(0) || admin.email.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-white">{admin.name || "Unnamed"}</h2>
              <p className="text-gray-500 text-sm">{admin.email}</p>
              <div className="mt-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${roleConfig.bgColor} ${roleConfig.color}`}
                >
                  <Shield className="w-4 h-4" />
                  {roleConfig.label}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm text-white">{admin.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <Clock className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Login</p>
                  <p className="text-sm text-white">
                    {admin.lastLoginAt
                      ? formatDistanceToNow(new Date(admin.lastLoginAt), { addSuffix: true })
                      : "Never"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Member Since</p>
                  <p className="text-sm text-white">
                    {format(new Date(admin.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Permissions */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-semibold text-white mb-4">Current Permissions</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {permissions.length > 0 ? (
                permissions.map((permission) => (
                  <div
                    key={permission}
                    className="px-3 py-2 bg-gray-800/50 rounded-lg text-sm text-gray-400"
                  >
                    {permission}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No permissions</p>
              )}
            </div>
          </div>
        </div>

        {/* Role Management */}
        <div className="lg:col-span-2">
          <AdminRoleForm
            adminId={admin.id}
            currentRole={admin.role as UserRole}
            adminName={admin.name || admin.email}
            canModify={canModify}
          />
        </div>
      </div>
    </div>
  );
}
