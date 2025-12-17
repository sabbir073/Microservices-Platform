import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin, type UserRole } from "@/lib/rbac";
import {
  Users,
  Wallet,
  ListTodo,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

// Stats Card Component
function StatsCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  href,
}: {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative";
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {changeType === "positive" ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-400" />
              )}
              <span
                className={
                  changeType === "positive" ? "text-emerald-400" : "text-red-400"
                }
              >
                {change}
              </span>
              <span className="text-gray-500 text-sm">vs last week</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-red-500/10 rounded-lg">
          <Icon className="w-6 h-6 text-red-400" />
        </div>
      </div>
    </Link>
  );
}

// Pending Item Component
function PendingItem({
  title,
  description,
  time,
  status,
  href,
}: {
  title: string;
  description: string;
  time: string;
  status: "pending" | "approved" | "rejected";
  href: string;
}) {
  const statusConfig = {
    pending: { icon: AlertCircle, color: "text-amber-400 bg-amber-500/10" },
    approved: { icon: CheckCircle, color: "text-emerald-400 bg-emerald-500/10" },
    rejected: { icon: XCircle, color: "text-red-400 bg-red-500/10" },
  };

  const { icon: StatusIcon, color } = statusConfig[status];

  return (
    <Link
      href={href}
      className="flex items-start gap-4 py-4 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 px-2 -mx-2 rounded-lg transition-colors"
    >
      <div className={`p-2 rounded-lg ${color}`}>
        <StatusIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        {time}
      </div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Check admin role
  if (!isAdmin(session.user.role as UserRole)) {
    redirect("/dashboard");
  }

  // Fetch admin dashboard stats
  const [
    totalUsers,
    activeTasks,
    pendingWithdrawalsCount,
    recentUsers,
    pendingTaskSubmissionsRaw,
    pendingWithdrawalsRaw,
  ] = await Promise.all([
    // Total users count
    prisma.user.count(),
    // Active tasks count
    prisma.task.count({ where: { status: "ACTIVE" } }),
    // Pending withdrawals count
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    // Recent users (last 5)
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Pending task submissions (last 5)
    prisma.taskSubmission.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Pending withdrawals (last 5)
    prisma.withdrawal.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Fetch related data for task submissions
  const taskIds = [...new Set(pendingTaskSubmissionsRaw.map(s => s.taskId))];
  const userIds = [...new Set([
    ...pendingTaskSubmissionsRaw.map(s => s.userId),
    ...pendingWithdrawalsRaw.map(w => w.userId),
  ])];

  const [tasks, users] = await Promise.all([
    taskIds.length > 0 ? prisma.task.findMany({ where: { id: { in: taskIds } } }) : [],
    userIds.length > 0 ? prisma.user.findMany({ where: { id: { in: userIds } } }) : [],
  ]);

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const userMap = new Map(users.map(u => [u.id, u]));

  // Map task submissions with related data
  const pendingTaskSubmissions = pendingTaskSubmissionsRaw.map(s => ({
    ...s,
    task: taskMap.get(s.taskId),
    user: userMap.get(s.userId),
  }));

  // Map withdrawals with related data
  const pendingWithdrawalsList = pendingWithdrawalsRaw.map(w => ({
    ...w,
    user: userMap.get(w.userId),
  }));

  const revenue = 0; // TODO: Calculate from subscriptions when needed
  const pendingWithdrawals = pendingWithdrawalsCount;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Overview of platform statistics and pending actions.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={totalUsers.toLocaleString()}
          icon={Users}
          href="/admin/users"
        />
        <StatsCard
          title="Active Tasks"
          value={activeTasks.toLocaleString()}
          icon={ListTodo}
          href="/admin/tasks"
        />
        <StatsCard
          title="Pending Withdrawals"
          value={pendingWithdrawals.toLocaleString()}
          icon={Wallet}
          href="/admin/withdrawals"
        />
        <StatsCard
          title="Total Revenue"
          value={`$${revenue.toFixed(2)}`}
          icon={TrendingUp}
          href="/admin/reports"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Withdrawals */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Pending Withdrawals
            </h2>
            <Link
              href="/admin/withdrawals"
              className="text-sm text-red-400 hover:text-red-300"
            >
              View all
            </Link>
          </div>
          <div className="space-y-0">
            {pendingWithdrawalsList.length > 0 ? (
              pendingWithdrawalsList.map((withdrawal) => (
                <PendingItem
                  key={withdrawal.id}
                  title={`$${withdrawal.amount.toFixed(2)} via ${withdrawal.method}`}
                  description={withdrawal.user?.name || withdrawal.user?.email || "Unknown user"}
                  time={formatDistanceToNow(withdrawal.createdAt, { addSuffix: true })}
                  status="pending"
                  href={`/admin/withdrawals/${withdrawal.id}`}
                />
              ))
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No pending withdrawals</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pending Task Submissions */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Pending Task Reviews
            </h2>
            <Link
              href="/admin/tasks"
              className="text-sm text-red-400 hover:text-red-300"
            >
              View all
            </Link>
          </div>
          <div className="space-y-0">
            {pendingTaskSubmissions.length > 0 ? (
              pendingTaskSubmissions.map((submission) => (
                <PendingItem
                  key={submission.id}
                  title={submission.task?.title || "Unknown task"}
                  description={submission.user?.name || submission.user?.email || "Unknown user"}
                  time={formatDistanceToNow(submission.createdAt, { addSuffix: true })}
                  status="pending"
                  href={`/admin/tasks/submissions/${submission.id}`}
                />
              ))
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No pending task submissions</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Users</h2>
          <Link
            href="/admin/users"
            className="text-sm text-red-400 hover:text-red-300"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                  User
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                  Email
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.length > 0 ? (
                recentUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-800 last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                          {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                        </div>
                        <span className="text-sm text-white">{user.name || "Unnamed"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : user.status === "PENDING_VERIFICATION"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        {user.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {formatDistanceToNow(user.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No users yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/admin/users"
          className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors text-center"
        >
          <Users className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-white">Manage Users</p>
        </Link>
        <Link
          href="/admin/tasks"
          className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors text-center"
        >
          <ListTodo className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-white">Manage Tasks</p>
        </Link>
        <Link
          href="/admin/withdrawals"
          className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors text-center"
        >
          <Wallet className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-white">Withdrawals</p>
        </Link>
        <Link
          href="/admin/reports"
          className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors text-center"
        >
          <TrendingUp className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-white">View Reports</p>
        </Link>
      </div>
    </div>
  );
}
