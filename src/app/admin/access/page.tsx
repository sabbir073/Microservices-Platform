import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Shield,
  Users,
  Crown,
  Settings,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  hasPermission,
  type UserRole,
  ADMIN_ROLES,
  ROLE_CONFIG,
} from "@/lib/rbac";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    role?: string;
    search?: string;
  }>;
}

export default async function AdminAccessPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "admins.view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const roleFilter = params.role || "";
  const searchQuery = params.search || "";

  // Build where clause
  const where: Record<string, unknown> = {
    role: { in: ADMIN_ROLES },
  };

  if (roleFilter) {
    where.role = roleFilter as UserRole;
  }

  if (searchQuery) {
    where.OR = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { email: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  // Fetch admin users
  const [admins, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: pageSize,
      skip,
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
    }),
    prisma.user.count({ where }),
  ]);

  // Get role counts
  const roleCounts = await prisma.user.groupBy({
    by: ["role"],
    where: {
      role: { in: ADMIN_ROLES },
    },
    _count: { id: true },
  });

  // Type assertion for groupBy
  type RoleCount = { role: string; _count: { id: number } };
  const typedRoleCounts = roleCounts as RoleCount[];

  const roleCountMap = typedRoleCounts.reduce((acc, item) => {
    acc[item.role] = item._count.id;
    return acc;
  }, {} as Record<string, number>);

  const totalPages = Math.ceil(totalCount / pageSize);
  const canManage = hasPermission(adminRole, "admins.manage");

  const buildQueryString = (newPage: number, newRole?: string) => {
    const queryParams = new URLSearchParams();
    queryParams.set("page", newPage.toString());
    if (newRole || roleFilter) queryParams.set("role", newRole || roleFilter);
    if (searchQuery) queryParams.set("search", searchQuery);
    return queryParams.toString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-gray-400 mt-1">
            Manage admin users and their permissions
          </p>
        </div>
        {canManage && (
          <Link
            href="/admin/access/invite"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Admin
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {ADMIN_ROLES.filter(r => r !== "USER").map((role) => {
          const config = ROLE_CONFIG[role];
          return (
            <Link
              key={role}
              href={`/admin/access?${buildQueryString(1, role)}`}
              className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
                roleFilter === role
                  ? "border-indigo-500"
                  : "border-gray-800 hover:border-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Shield className={`w-4 h-4 ${config.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">
                    {roleCountMap[role] || 0}
                  </p>
                  <p className="text-xs text-gray-500">{config.label}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <form className="flex-1 max-w-md" action="/admin/access" method="GET">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Search admins..."
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
            />
            {roleFilter && <input type="hidden" name="role" value={roleFilter} />}
          </div>
        </form>

        <div className="flex gap-2">
          <Link
            href="/admin/access"
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              !roleFilter
                ? "bg-indigo-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All Roles
          </Link>
        </div>
      </div>

      {/* Admin List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {admins.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Admin
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Role
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Status
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Last Login
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Joined
                  </th>
                  {canManage && (
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {admins.map((admin) => {
                  const roleConfig = ROLE_CONFIG[admin.role as UserRole];
                  return (
                    <tr key={admin.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
                            {admin.name?.charAt(0) || admin.email.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {admin.name || "Unnamed"}
                            </p>
                            <p className="text-xs text-gray-500">{admin.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleConfig.bgColor} ${roleConfig.color}`}
                        >
                          <Shield className="w-3 h-3" />
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            admin.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : admin.status === "SUSPENDED"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {admin.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-400">
                        {admin.lastLoginAt
                          ? formatDistanceToNow(new Date(admin.lastLoginAt), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {formatDistanceToNow(new Date(admin.createdAt), {
                          addSuffix: true,
                        })}
                      </td>
                      {canManage && (
                        <td className="py-4 px-6">
                          <Link
                            href={`/admin/access/${admin.id}`}
                            className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            Manage
                          </Link>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-medium text-white mb-2">No admins found</h3>
            <p className="text-gray-400">
              {searchQuery
                ? "Try adjusting your search criteria"
                : "Invite team members to help manage the platform"}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {skip + 1} - {Math.min(skip + pageSize, totalCount)} of{" "}
              {totalCount}
            </p>
            <div className="flex gap-2">
              <Link
                href={page > 1 ? `/admin/access?${buildQueryString(page - 1)}` : "#"}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  page > 1
                    ? "bg-gray-800 text-white hover:bg-gray-700"
                    : "bg-gray-800/50 text-gray-600 cursor-not-allowed"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Link>
              <Link
                href={
                  page < totalPages
                    ? `/admin/access?${buildQueryString(page + 1)}`
                    : "#"
                }
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  page < totalPages
                    ? "bg-gray-800 text-white hover:bg-gray-700"
                    : "bg-gray-800/50 text-gray-600 cursor-not-allowed"
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Permissions Overview */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Roles & Permissions Overview</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ADMIN_ROLES.filter(r => r !== "USER").map((role) => {
            const config = ROLE_CONFIG[role];
            return (
              <div
                key={role}
                className={`p-4 rounded-lg border ${config.bgColor} border-gray-700`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`w-4 h-4 ${config.color}`} />
                  <span className={`font-medium ${config.color}`}>{config.label}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {role === "SUPER_ADMIN" && "Full access to all features and settings"}
                  {role === "FINANCE_ADMIN" && "Manage withdrawals, packages, and financial analytics"}
                  {role === "CONTENT_ADMIN" && "Create and manage tasks, quizzes, and content"}
                  {role === "SUPPORT_ADMIN" && "Handle user issues, KYC, and disputes"}
                  {role === "MARKETING_ADMIN" && "Manage notifications and view analytics"}
                  {role === "MODERATOR" && "Review and approve task submissions"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
