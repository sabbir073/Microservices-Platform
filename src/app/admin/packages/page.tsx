import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Package,
  Crown,
  Star,
  Sparkles,
  Users,
  DollarSign,
  Edit,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  Gift,
} from "lucide-react";
import Link from "next/link";
import { hasPermission, type UserRole } from "@/lib/rbac";

const tierConfig: Record<string, { icon: typeof Package; color: string; bgColor: string }> = {
  FREE: { icon: Package, color: "text-gray-400", bgColor: "bg-gray-500/10" },
  BASIC: { icon: Star, color: "text-blue-400", bgColor: "bg-blue-500/10" },
  STANDARD: { icon: Sparkles, color: "text-indigo-400", bgColor: "bg-indigo-500/10" },
  PREMIUM: { icon: Crown, color: "text-purple-400", bgColor: "bg-purple-500/10" },
};

export default async function AdminPackagesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "packages.view")) {
    redirect("/admin");
  }

  // Fetch packages and subscriber stats
  const [packagesRaw, subscriberStats] = await Promise.all([
    prisma.package.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.user.groupBy({
      by: ["packageTier"],
      _count: { id: true },
    }),
  ]);

  // Type assertion for Prisma Accelerate
  const packages = packagesRaw as typeof packagesRaw;

  // Type assertion for groupBy result
  type SubscriberStat = {
    packageTier: string;
    _count: { id: number };
  };
  const stats = subscriberStats as SubscriberStat[];

  // Create a map of subscriber counts
  const subscriberCounts: Record<string, number> = {};
  stats.forEach((stat) => {
    subscriberCounts[stat.packageTier] = stat._count.id;
  });

  // Calculate total subscribers and revenue
  const totalSubscribers = Object.values(subscriberCounts).reduce((a, b) => a + b, 0);
  const paidSubscribers = totalSubscribers - (subscriberCounts["FREE"] || 0);

  // Calculate estimated monthly revenue
  let estimatedRevenue = 0;
  packages.forEach((pkg) => {
    if (pkg.tier !== "FREE") {
      const count = subscriberCounts[pkg.tier] || 0;
      estimatedRevenue += count * pkg.priceMonthly;
    }
  });

  const canEdit = hasPermission(adminRole, "packages.edit");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Package Management</h1>
          <p className="text-gray-400 mt-1">
            Configure subscription packages and pricing
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalSubscribers}</p>
              <p className="text-sm text-gray-500">Total Users</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Crown className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{paidSubscribers}</p>
              <p className="text-sm text-gray-500">Paid Subscribers</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">${estimatedRevenue.toFixed(2)}</p>
              <p className="text-sm text-gray-500">Est. Monthly Revenue</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {totalSubscribers > 0 ? ((paidSubscribers / totalSubscribers) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-sm text-gray-500">Conversion Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {packages.map((pkg) => {
          const config = tierConfig[pkg.tier] || tierConfig.FREE;
          const Icon = config.icon;
          const subscriberCount = subscriberCounts[pkg.tier] || 0;

          return (
            <div
              key={pkg.id}
              className={`bg-gray-900 rounded-xl border overflow-hidden ${
                pkg.tier === "PREMIUM"
                  ? "border-purple-500/50"
                  : pkg.tier === "STANDARD"
                  ? "border-indigo-500/30"
                  : pkg.tier === "BASIC"
                  ? "border-blue-500/30"
                  : "border-gray-800"
              }`}
            >
              {/* Header */}
              <div className={`p-6 ${config.bgColor}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gray-900/50`}>
                    <Icon className={`w-6 h-6 ${config.color}`} />
                  </div>
                  {pkg.isActive ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                      Inactive
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white">{pkg.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{pkg.description}</p>
              </div>

              {/* Pricing */}
              <div className="p-6 border-t border-gray-800">
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-white">
                    ${pkg.priceMonthly.toFixed(2)}
                  </span>
                  <span className="text-gray-500">/month</span>
                </div>
                {pkg.priceYearly && (
                  <p className="text-sm text-gray-400">
                    or ${pkg.priceYearly.toFixed(2)}/year (save{" "}
                    {Math.round((1 - pkg.priceYearly / (pkg.priceMonthly * 12)) * 100)}%)
                  </p>
                )}
              </div>

              {/* Features */}
              <div className="p-6 border-t border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">Daily Tasks</span>
                  </div>
                  <span className="text-white font-medium">
                    {pkg.dailyTaskLimit === -1 ? "Unlimited" : pkg.dailyTaskLimit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">Min Withdrawal</span>
                  </div>
                  <span className="text-white font-medium">${pkg.minWithdrawal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">Withdrawal Fee</span>
                  </div>
                  <span className="text-white font-medium">{pkg.withdrawalFee}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">Referral Bonus</span>
                  </div>
                  <span className="text-white font-medium">{pkg.referralBonus}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">XP Multiplier</span>
                  </div>
                  <span className="text-white font-medium">{pkg.xpMultiplier}x</span>
                </div>
              </div>

              {/* Feature List */}
              {pkg.features.length > 0 && (
                <div className="p-6 border-t border-gray-800">
                  <p className="text-sm font-medium text-gray-400 mb-3">Features</p>
                  <ul className="space-y-2">
                    {pkg.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Subscribers & Actions */}
              <div className="p-6 border-t border-gray-800 bg-gray-800/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">Subscribers</span>
                  </div>
                  <span className="text-white font-semibold">{subscriberCount.toLocaleString()}</span>
                </div>
                {canEdit && (
                  <Link
                    href={`/admin/packages/${pkg.id}/edit`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Package
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Payments Section */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Pending Payment Verifications</h2>
          <Link
            href="/admin/packages/payments"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            View All
          </Link>
        </div>
        <div className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">Payment verification queue coming soon</p>
        </div>
      </div>
    </div>
  );
}
