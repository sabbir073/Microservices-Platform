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
import { AdRenderer } from "@/components/user/primitives/ad-renderer";
import { taskRunHref } from "@/lib/task-routes";
import { getProfileGateState } from "@/lib/profile-gate-server";
import { ProfileCompletionBanner } from "@/components/user/primitives/profile-completion-banner";
import { getKycPromptState } from "@/lib/kyc-prompt-server";
import { KycPromptBanner } from "@/components/user/primitives/kyc-prompt-banner";

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
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-extrabold text-white mt-1 tracking-tight tabular-nums">{value}</p>
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
        <div className="grid place-items-center h-11 w-11 bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 rounded-xl">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// Quick Action Card
const QA_TONE: Record<string, string> = {
  indigo: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20",
  amber: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  pink: "bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20",
};

function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  tone = "indigo",
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  tone?: "indigo" | "amber" | "emerald" | "pink";
}) {
  return (
    <Link href={href} className="card card-interactive p-5 group block">
      <div
        className={`w-12 h-12 rounded-xl grid place-items-center mb-4 ${QA_TONE[tone]}`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
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
  const [userData, tasksCompleted, referralsCount, availableTasks] =
    await Promise.all([
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
      prisma.task.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          type: true,
          pointsReward: true,
          xpReward: true,
          difficulty: true,
        },
        // Shared, slow-changing list — serve from Accelerate cache to cut
        // dashboard render time.
        cacheStrategy: { ttl: 60, swr: 120 },
      }),
    ]);

  const [gate, kycPrompt] = await Promise.all([
    getProfileGateState(session.user.id),
    getKycPromptState(session.user.id),
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
      {gate.locked && (
        <ProfileCompletionBanner
          done={gate.progress.done}
          total={gate.progress.total}
          percentage={gate.progress.percentage}
        />
      )}
      {kycPrompt.show && <KycPromptBanner />}

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
            tone="indigo"
          />
          <QuickActionCard
            title="Invite Friends"
            description="Earn commissions from referrals"
            href="/referrals"
            icon={Users}
            tone="amber"
          />
          <QuickActionCard
            title="Daily Bonus"
            description="Claim your daily rewards"
            href="/earn"
            icon={Gift}
            tone="emerald"
          />
          <QuickActionCard
            title="Leaderboard"
            description="See top earners this week"
            href="/leaderboard"
            icon={Trophy}
            tone="pink"
          />
        </div>
      </div>

      <AdRenderer placement="DASHBOARD" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 card p-6">
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
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Daily Streak
            </h3>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3">
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
          <div className="card p-6">
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
                  className="h-full bg-linear-to-r from-indigo-500 to-purple-600 rounded-full"
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
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Available Tasks</h2>
          <Link
            href="/tasks"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            View all tasks
          </Link>
        </div>
        {availableTasks.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <div className="text-center">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No tasks available right now</p>
              <p className="text-sm mt-1">Check back soon for new tasks!</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableTasks.map((t) => (
              <Link
                key={t.id}
                href={taskRunHref(t.type, t.id)}
                className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950 p-3 hover:border-indigo-500/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate group-hover:text-indigo-400 transition-colors">
                    {t.title}
                  </p>
                  <p className="text-[11px] text-gray-500 capitalize">
                    {t.type.toLowerCase()}
                    {t.difficulty ? ` · ${t.difficulty.toLowerCase()}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-amber-400 tabular-nums">
                    +{t.pointsReward.toLocaleString()}
                  </p>
                  {t.xpReward > 0 && (
                    <p className="text-[10px] text-gray-500">+{t.xpReward} XP</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
