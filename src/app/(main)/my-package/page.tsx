import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Crown, Calendar, CreditCard, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

export default async function MyPackagePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      packageTier: true,
      packageExpiresAt: true,
    },
  });
  const pkg = user?.packageTier
    ? await prisma.package.findUnique({ where: { tier: user.packageTier } })
    : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">My Package</h1>

      <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-amber-600/15 via-purple-600/10 to-gray-900 p-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
            <Crown className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
              Current Plan
            </p>
            <p className="text-2xl font-extrabold text-white">
              {pkg?.name ?? "Free"}
            </p>
            {pkg?.description && (
              <p className="text-xs text-gray-400 mt-0.5">{pkg.description}</p>
            )}
          </div>
        </div>

        {user?.packageExpiresAt && (
          <div className="relative mt-4 inline-flex items-center gap-1.5 text-xs text-gray-300">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            Expires {format(user.packageExpiresAt, "PP")}
          </div>
        )}
      </div>

      {pkg && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">
            Package details
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Daily tasks</p>
              <p className="font-bold text-white tabular-nums">
                {pkg.dailyTaskLimit}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Withdrawal fee</p>
              <p className="font-bold text-white tabular-nums">
                {(pkg.withdrawalFee * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Monthly</p>
              <p className="font-bold text-white tabular-nums">
                ${pkg.priceMonthly.toFixed(2)}
              </p>
            </div>
            {pkg.priceYearly && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Yearly</p>
                <p className="font-bold text-white tabular-nums">
                  ${pkg.priceYearly.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <Link
        href="/packages"
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white font-bold"
      >
        <CreditCard className="w-4 h-4" />
        Upgrade Plan
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
