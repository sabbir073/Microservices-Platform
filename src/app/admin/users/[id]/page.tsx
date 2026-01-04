import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  Wallet,
  Star,
  Trophy,
  Users,
  Gift,
  FileCheck,
  Activity,
  Package,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { hasPermission, ROLE_CONFIG, type UserRole } from "@/lib/rbac";
import { UserDetailActions, AdjustBalanceButton } from "@/components/admin/user-detail-actions";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function UserDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "users.view")) {
    redirect("/admin");
  }

  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  // Fetch user with related data using separate queries
  const [userData, counts] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        taskSubmissions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            task: {
              select: {
                id: true,
                title: true,
                type: true,
                pointsReward: true,
              },
            },
          },
        },
        withdrawals: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        referrals: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            status: true,
          },
        },
        kycDocuments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        referredBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            referrals: true,
            taskSubmissions: true,
            transactions: true,
            withdrawals: true,
          },
        },
      },
    }),
  ]);

  if (!userData || !counts) {
    notFound();
  }

  // Type assertion needed due to Prisma Accelerate extension type inference issues
  const user = userData as typeof userData & {
    transactions: Array<{
      id: string;
      type: string;
      points: number;
      amount: number;
      description: string | null;
      status: string;
      createdAt: Date;
    }>;
    taskSubmissions: Array<{
      id: string;
      status: string;
      createdAt: Date;
      task: {
        id: string;
        title: string;
        type: string;
        pointsReward: number;
      };
    }>;
    withdrawals: Array<{
      id: string;
      amount: number;
      fee: number;
      netAmount: number;
      method: string;
      status: string;
      createdAt: Date;
    }>;
    referrals: Array<{
      id: string;
      name: string | null;
      email: string;
      status: string;
      createdAt: Date;
    }>;
  };

  const roleConfig = ROLE_CONFIG[user.role as UserRole] || ROLE_CONFIG.USER;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "transactions", label: "Transactions", count: counts._count.transactions },
    { id: "tasks", label: "Tasks", count: counts._count.taskSubmissions },
    { id: "referrals", label: "Referrals", count: counts._count.referrals },
    { id: "withdrawals", label: "Withdrawals", count: counts._count.withdrawals },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">User Profile</h1>
          <p className="text-gray-400">
            Manage user account and view activity
          </p>
        </div>
        <UserDetailActions
          userId={id}
          userName={user.name}
          userEmail={user.email}
          userStatus={user.status}
          canEdit={hasPermission(adminRole, "users.edit")}
          canBan={hasPermission(adminRole, "users.ban")}
        />
      </div>

      {/* User Profile Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user.name || "Unnamed"}</h2>
              {user.username && (
                <p className="text-gray-400">@{user.username}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
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
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.bgColor} ${roleConfig.color}`}>
                  {roleConfig.label}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-500" />
              <span className="text-gray-400">{user.email}</span>
              {user.emailVerified && (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            {user.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">{user.phone}</span>
                {user.phoneVerified && (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
              </div>
            )}
            {user.country && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">{user.country}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-400">
                Joined {format(user.createdAt, "MMM d, yyyy")} ({formatDistanceToNow(user.createdAt, { addSuffix: true })})
              </span>
            </div>
            {user.lastLoginAt && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">
                  Last active {formatDistanceToNow(user.lastLoginAt, { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-500">Level</span>
          </div>
          <p className="text-xl font-bold text-white">{user.level}</p>
          <p className="text-xs text-gray-500">{user.xp.toLocaleString()} XP</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-gray-500">Points</span>
          </div>
          <p className="text-xl font-bold text-white">{user.pointsBalance.toLocaleString()}</p>
          <div className="flex gap-1 mt-1">
            <AdjustBalanceButton userId={id} type="points" action="add" canAdjust={hasPermission(adminRole, "users.adjust_balance")} />
            <AdjustBalanceButton userId={id} type="points" action="deduct" canAdjust={hasPermission(adminRole, "users.adjust_balance")} />
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-500">Cash Balance</span>
          </div>
          <p className="text-xl font-bold text-white">${user.cashBalance.toFixed(2)}</p>
          <div className="flex gap-1 mt-1">
            <AdjustBalanceButton userId={id} type="cash" action="add" canAdjust={hasPermission(adminRole, "users.adjust_balance")} />
            <AdjustBalanceButton userId={id} type="cash" action="deduct" canAdjust={hasPermission(adminRole, "users.adjust_balance")} />
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-500">Package</span>
          </div>
          <p className={`text-xl font-bold ${
            user.packageTier === "PREMIUM" ? "text-purple-400" :
            user.packageTier === "STANDARD" ? "text-indigo-400" :
            user.packageTier === "BASIC" ? "text-blue-400" :
            "text-gray-400"
          }`}>{user.packageTier}</p>
          {user.packageExpiresAt && (
            <p className="text-xs text-gray-500">
              Expires {format(user.packageExpiresAt, "MMM d")}
            </p>
          )}
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-500">KYC Status</span>
          </div>
          <p className={`text-xl font-bold ${
            user.kycStatus === "APPROVED" ? "text-emerald-400" :
            user.kycStatus === "PENDING" ? "text-amber-400" :
            user.kycStatus === "REJECTED" ? "text-red-400" :
            "text-gray-400"
          }`}>{user.kycStatus.replace(/_/g, " ")}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-500">Referrals</span>
          </div>
          <p className="text-xl font-bold text-white">{counts._count.referrals}</p>
          <p className="text-xs text-gray-500">Code: {user.referralCode}</p>
        </div>
      </div>

      {/* Referrer Info */}
      {user.referredById && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5 text-indigo-400" />
            <span className="text-sm text-gray-400">Referred by:</span>
            <Link
              href={`/admin/users/${user.referredById}`}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View referrer
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/admin/users/${id}?tab=${t.id}`}
              className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-red-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-800 rounded">
                  {t.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {tab === "overview" && (
          <div className="p-6 space-y-6">
            {/* Earnings Summary */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Earnings Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Total Earned</p>
                  <p className="text-xl font-bold text-emerald-400">${user.totalEarnings.toFixed(2)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Total Withdrawn</p>
                  <p className="text-xl font-bold text-amber-400">${user.totalWithdrawals.toFixed(2)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Tasks Completed</p>
                  <p className="text-xl font-bold text-indigo-400">{counts._count.taskSubmissions}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Current Streak</p>
                  <p className="text-xl font-bold text-purple-400">{user.streak} days</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {user.transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        tx.type === "TASK_REWARD" || tx.type === "REFERRAL_BONUS" || tx.type === "BONUS"
                          ? "bg-emerald-500/10"
                          : tx.type === "WITHDRAWAL"
                          ? "bg-red-500/10"
                          : "bg-gray-500/10"
                      }`}>
                        <Activity className={`w-4 h-4 ${
                          tx.type === "TASK_REWARD" || tx.type === "REFERRAL_BONUS" || tx.type === "BONUS"
                            ? "text-emerald-400"
                            : tx.type === "WITHDRAWAL"
                            ? "text-red-400"
                            : "text-gray-400"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm text-white">{tx.type.replace(/_/g, " ")}</p>
                        <p className="text-xs text-gray-500">{tx.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {tx.points !== 0 && (
                        <p className={`text-sm font-medium ${tx.points > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {tx.points > 0 ? "+" : ""}{tx.points.toLocaleString()} pts
                        </p>
                      )}
                      {tx.amount !== 0 && (
                        <p className={`text-sm font-medium ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">{formatDistanceToNow(tx.createdAt, { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
                {user.transactions.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No transactions yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "transactions" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Type</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Description</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Points</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {user.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-800 last:border-0">
                    <td className="py-4 px-6 text-sm text-white">{tx.type.replace(/_/g, " ")}</td>
                    <td className="py-4 px-6 text-sm text-gray-400">{tx.description || "-"}</td>
                    <td className={`py-4 px-6 text-sm font-medium ${tx.points > 0 ? "text-emerald-400" : tx.points < 0 ? "text-red-400" : "text-gray-400"}`}>
                      {tx.points !== 0 ? `${tx.points > 0 ? "+" : ""}${tx.points.toLocaleString()}` : "-"}
                    </td>
                    <td className={`py-4 px-6 text-sm font-medium ${tx.amount > 0 ? "text-emerald-400" : tx.amount < 0 ? "text-red-400" : "text-gray-400"}`}>
                      {tx.amount !== 0 ? `${tx.amount > 0 ? "+" : ""}$${tx.amount.toFixed(2)}` : "-"}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tx.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400" :
                        tx.status === "PENDING" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-400">{format(tx.createdAt, "MMM d, yyyy HH:mm")}</td>
                  </tr>
                ))}
                {user.transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">No transactions found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "tasks" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Task</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Type</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Reward</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {user.taskSubmissions.map((submission) => (
                  <tr key={submission.id} className="border-b border-gray-800 last:border-0">
                    <td className="py-4 px-6 text-sm text-white">{submission.task.title}</td>
                    <td className="py-4 px-6 text-sm text-gray-400">{submission.task.type.replace(/_/g, " ")}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        submission.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400" :
                        submission.status === "PENDING" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {submission.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-indigo-400">{submission.task.pointsReward.toLocaleString()} pts</td>
                    <td className="py-4 px-6 text-sm text-gray-400">{formatDistanceToNow(submission.createdAt, { addSuffix: true })}</td>
                  </tr>
                ))}
                {user.taskSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">No task submissions found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "referrals" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">User</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Joined</th>
                </tr>
              </thead>
              <tbody>
                {user.referrals.map((referral) => (
                  <tr key={referral.id} className="border-b border-gray-800 last:border-0">
                    <td className="py-4 px-6">
                      <Link href={`/admin/users/${referral.id}`} className="flex items-center gap-3 hover:text-indigo-400 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                          {referral.name?.charAt(0) || referral.email?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{referral.name || "Unnamed"}</p>
                          <p className="text-xs text-gray-500">{referral.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        referral.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" :
                        referral.status === "PENDING_VERIFICATION" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {referral.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-400">{formatDistanceToNow(referral.createdAt, { addSuffix: true })}</td>
                  </tr>
                ))}
                {user.referrals.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">No referrals found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "withdrawals" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Method</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Fee</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Net</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Requested</th>
                </tr>
              </thead>
              <tbody>
                {user.withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="border-b border-gray-800 last:border-0">
                    <td className="py-4 px-6 text-sm font-medium text-white">${withdrawal.amount.toFixed(2)}</td>
                    <td className="py-4 px-6 text-sm text-gray-400">{withdrawal.method}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        withdrawal.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400" :
                        withdrawal.status === "PENDING" ? "bg-amber-500/10 text-amber-400" :
                        withdrawal.status === "PROCESSING" ? "bg-blue-500/10 text-blue-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {withdrawal.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-400">${withdrawal.fee.toFixed(2)}</td>
                    <td className="py-4 px-6 text-sm text-emerald-400">${withdrawal.netAmount.toFixed(2)}</td>
                    <td className="py-4 px-6 text-sm text-gray-400">{formatDistanceToNow(withdrawal.createdAt, { addSuffix: true })}</td>
                  </tr>
                ))}
                {user.withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">No withdrawals found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
