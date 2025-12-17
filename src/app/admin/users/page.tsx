import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Ban,
  Eye,
  Edit,
  Download,
  Plus,
  FileCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { hasPermission, ROLE_CONFIG, type UserRole } from "@/lib/rbac";
import { Prisma } from "@/generated/prisma/client";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    role?: string;
    kyc?: string;
    package?: string;
    search?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = session.user.role as UserRole | undefined;
  if (!hasPermission(userRole, "users.view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  // Build where clause based on filters
  const where: Prisma.UserWhereInput = {};

  if (params.status && params.status !== "all") {
    where.status = params.status as Prisma.EnumUserStatusFilter["equals"];
  }

  if (params.role && params.role !== "all") {
    where.role = params.role as Prisma.EnumUserRoleFilter["equals"];
  }

  if (params.kyc && params.kyc !== "all") {
    where.kycStatus = params.kyc as Prisma.EnumKYCStatusFilter["equals"];
  }

  if (params.package && params.package !== "all") {
    where.packageTier = params.package as Prisma.EnumPackageTierFilter["equals"];
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
      { username: { contains: params.search, mode: "insensitive" } },
    ];
  }

  // Fetch users and stats
  const [
    allUsers,
    totalCount,
    activeCount,
    pendingCount,
    bannedCount,
    pendingKycCount,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        status: true,
        kycStatus: true,
        packageTier: true,
        pointsBalance: true,
        cashBalance: true,
        level: true,
        country: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "PENDING_VERIFICATION" } }),
    prisma.user.count({ where: { status: "BANNED" } }),
    prisma.user.count({ where: { kycStatus: "PENDING" } }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Build query string for pagination links
  const buildQueryString = (newPage: number) => {
    const queryParams = new URLSearchParams();
    queryParams.set("page", newPage.toString());
    if (params.status) queryParams.set("status", params.status);
    if (params.role) queryParams.set("role", params.role);
    if (params.kyc) queryParams.set("kyc", params.kyc);
    if (params.package) queryParams.set("package", params.package);
    if (params.search) queryParams.set("search", params.search);
    return queryParams.toString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Users Management</h1>
          <p className="text-gray-400 mt-1">
            Manage and monitor all platform users
          </p>
        </div>
        <div className="flex gap-3">
          {pendingKycCount > 0 && (
            <Link
              href="/admin/users/kyc"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              KYC Queue ({pendingKycCount})
            </Link>
          )}
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          {hasPermission(userRole, "users.edit") && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
              <Plus className="w-4 h-4" />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/admin/users"
          className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-indigo-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeCount + pendingCount + bannedCount}</p>
              <p className="text-sm text-gray-500">Total Users</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/users?status=ACTIVE"
          className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
            params.status === "ACTIVE" ? "border-emerald-500/50" : "border-gray-800 hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/users?status=PENDING_VERIFICATION"
          className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
            params.status === "PENDING_VERIFICATION" ? "border-amber-500/50" : "border-gray-800 hover:border-amber-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/users?status=BANNED"
          className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
            params.status === "BANNED" ? "border-red-500/50" : "border-gray-800 hover:border-red-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <Ban className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{bannedCount}</p>
              <p className="text-sm text-gray-500">Banned</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="search"
            name="search"
            defaultValue={params.search}
            placeholder="Search users by name, email, username..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_VERIFICATION">Pending</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BANNED">Banned</option>
          </select>
          <select
            name="role"
            defaultValue={params.role || "all"}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Roles</option>
            <option value="USER">User</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="FINANCE_ADMIN">Finance Admin</option>
            <option value="CONTENT_ADMIN">Content Admin</option>
            <option value="SUPPORT_ADMIN">Support Admin</option>
            <option value="MARKETING_ADMIN">Marketing Admin</option>
            <option value="MODERATOR">Moderator</option>
          </select>
          <select
            name="kyc"
            defaultValue={params.kyc || "all"}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All KYC</option>
            <option value="NOT_SUBMITTED">Not Submitted</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            name="package"
            defaultValue={params.package || "all"}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Packages</option>
            <option value="FREE">Free</option>
            <option value="BASIC">Basic</option>
            <option value="STANDARD">Standard</option>
            <option value="PREMIUM">Premium</option>
          </select>
          <button
            type="submit"
            className="p-2.5 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Users Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  User
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Status
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Role
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  KYC
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Package
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Balance
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Joined
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {allUsers.length > 0 ? (
                allUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="py-4 px-6">
                      <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
                          {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">
                            {user.name || "Unnamed"}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          {user.username && (
                            <p className="text-xs text-gray-600">@{user.username}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : user.status === "PENDING_VERIFICATION"
                          ? "bg-amber-500/10 text-amber-400"
                          : user.status === "SUSPENDED"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        {user.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {(() => {
                        const roleConfig = ROLE_CONFIG[user.role as UserRole] || ROLE_CONFIG.USER;
                        return (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.bgColor} ${roleConfig.color}`}>
                            {roleConfig.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.kycStatus === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : user.kycStatus === "PENDING"
                          ? "bg-amber-500/10 text-amber-400"
                          : user.kycStatus === "REJECTED"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}>
                        {user.kycStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.packageTier === "PREMIUM"
                          ? "bg-purple-500/10 text-purple-400"
                          : user.packageTier === "STANDARD"
                          ? "bg-indigo-500/10 text-indigo-400"
                          : user.packageTier === "BASIC"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}>
                        {user.packageTier}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <p className="text-white">${user.cashBalance.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{user.pointsBalance.toLocaleString()} pts</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-400">
                      <div>
                        <p>{formatDistanceToNow(user.createdAt, { addSuffix: true })}</p>
                        {user.lastLoginAt && (
                          <p className="text-xs text-gray-600">
                            Last: {formatDistanceToNow(user.lastLoginAt, { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {hasPermission(userRole, "users.edit") && (
                          <Link
                            href={`/admin/users/${user.id}/edit`}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        )}
                        {hasPermission(userRole, "users.ban") && user.status !== "BANNED" && (
                          <button
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Ban User"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No users found</p>
                    <p className="text-sm mt-1">
                      {params.search || params.status || params.role
                        ? "Try adjusting your filters"
                        : "Users will appear here once they register"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <p className="text-sm text-gray-500">
            Showing {skip + 1} - {Math.min(skip + pageSize, totalCount)} of {totalCount} users
          </p>
          <div className="flex gap-2">
            <Link
              href={page > 1 ? `/admin/users?${buildQueryString(page - 1)}` : "#"}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                page > 1
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "bg-gray-800/50 text-gray-600 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Link>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <Link
                    key={pageNum}
                    href={`/admin/users?${buildQueryString(pageNum)}`}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      pageNum === page
                        ? "bg-red-500 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    {pageNum}
                  </Link>
                );
              })}
            </div>
            <Link
              href={page < totalPages ? `/admin/users?${buildQueryString(page + 1)}` : "#"}
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
      </div>
    </div>
  );
}
