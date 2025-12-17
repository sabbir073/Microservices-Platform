import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Wallet,
  TrendingUp,
  CheckCircle,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Star,
  Gift,
  Trophy,
} from "lucide-react";
import Link from "next/link";

// Stats Card Component
function StatsCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
}: {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative";
  icon: React.ElementType;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
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
        <div className="p-3 bg-indigo-500/10 rounded-lg">
          <Icon className="w-6 h-6 text-indigo-400" />
        </div>
      </div>
    </div>
  );
}

// Quick Action Card
function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  color,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors group"
    >
      <div
        className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center mb-4`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </Link>
  );
}

// Recent Activity Item - Kept for future use
// function ActivityItem({
//   title,
//   description,
//   time,
//   type,
// }: {
//   title: string;
//   description: string;
//   time: string;
//   type: "earning" | "withdrawal" | "task" | "referral";
// }) {
//   const icons = {
//     earning: { icon: TrendingUp, color: "bg-emerald-500/10 text-emerald-400" },
//     withdrawal: { icon: Wallet, color: "bg-purple-500/10 text-purple-400" },
//     task: { icon: CheckCircle, color: "bg-indigo-500/10 text-indigo-400" },
//     referral: { icon: Users, color: "bg-amber-500/10 text-amber-400" },
//   };
//   const { icon: Icon, color } = icons[type];
//   return (
//     <div className="flex items-start gap-4 py-4 border-b border-gray-800 last:border-0">
//       <div className={`p-2 rounded-lg ${color}`}>
//         <Icon className="w-4 h-4" />
//       </div>
//       <div className="flex-1 min-w-0">
//         <p className="text-sm font-medium text-white">{title}</p>
//         <p className="text-xs text-gray-500 mt-0.5">{description}</p>
//       </div>
//       <div className="flex items-center gap-1 text-xs text-gray-500">
//         <Clock className="w-3 h-3" />
//         {time}
//       </div>
//     </div>
//   );
// }

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user data from database
  const [userData, tasksCompleted, referralsCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        pointsBalance: true,
        cashBalance: true,
        xp: true,
        level: true,
        streak: true,
        referralCode: true,
      },
    }),
    prisma.taskSubmission.count({
      where: { userId: session.user.id, status: "APPROVED" },
    }),
    prisma.user.count({
      where: { referredById: session.user.id },
    }),
  ]);

  const user = session.user;
  const points = userData?.pointsBalance ?? 0;
  const balance = userData?.cashBalance ?? 0;
  const xp = userData?.xp ?? 0;
  const level = userData?.level ?? 1;
  const streak = userData?.streak ?? 0;
  const xpForNextLevel = level * 100; // Simple formula: level * 100 XP needed
  const xpProgress = Math.min((xp / xpForNextLevel) * 100, 100);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user.name?.split(" ")[0] || "User"}!
        </h1>
        <p className="text-gray-400 mt-1">
          Here&apos;s what&apos;s happening with your earnings today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Points"
          value={points.toLocaleString()}
          icon={Wallet}
        />
        <StatsCard
          title="Available Balance"
          value={`$${balance.toFixed(2)}`}
          icon={TrendingUp}
        />
        <StatsCard
          title="Tasks Completed"
          value={tasksCompleted.toString()}
          icon={CheckCircle}
        />
        <StatsCard
          title="Referrals"
          value={referralsCount.toString()}
          icon={Users}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <QuickActionCard
            title="Complete Tasks"
            description="Earn points by completing tasks"
            href="/tasks"
            icon={CheckCircle}
            color="bg-gradient-to-br from-indigo-500 to-purple-600"
          />
          <QuickActionCard
            title="Invite Friends"
            description="Earn commissions from referrals"
            href="/referrals"
            icon={Users}
            color="bg-gradient-to-br from-amber-500 to-orange-600"
          />
          <QuickActionCard
            title="Daily Bonus"
            description="Claim your daily rewards"
            href="/earn"
            icon={Gift}
            color="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <QuickActionCard
            title="Leaderboard"
            description="See top earners this week"
            href="/leaderboard"
            icon={Trophy}
            color="bg-gradient-to-br from-pink-500 to-rose-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            <Link
              href="/wallet"
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              View all
            </Link>
          </div>
          <div className="space-y-0">
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="text-center">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No recent activity</p>
                <p className="text-sm mt-1">
                  Complete tasks to start earning!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Streak & Achievements */}
        <div className="space-y-6">
          {/* Daily Streak */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Daily Streak
            </h3>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl font-bold text-white">{streak}</span>
                </div>
                <p className="text-gray-400 text-sm">days</p>
                <p className="text-xs text-gray-500 mt-2">
                  {streak > 0 ? "Keep it up!" : "Check in daily to build your streak!"}
                </p>
              </div>
            </div>
          </div>

          {/* Level Progress */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Level</h3>
              <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-medium rounded-full">
                Level {level}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">XP Progress</span>
                <span className="text-white">{xp} / {xpForNextLevel} XP</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                Complete tasks to earn XP and level up!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Available Tasks Preview */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Available Tasks</h2>
          <Link
            href="/tasks"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            View all tasks
          </Link>
        </div>
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tasks available right now</p>
            <p className="text-sm mt-1">Check back soon for new tasks!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
