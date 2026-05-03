import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  MyPackageView,
  type PackageData,
  type SubscriptionHistoryItem,
} from "@/components/user/packages/my-package-view";

export default async function MyPackagePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [user, subscriptions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        packageTier: true,
        packageExpiresAt: true,
      },
    }),
    prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!user) redirect("/login");

  const pkg = await prisma.package.findUnique({
    where: { tier: user.packageTier },
  });

  const currentPackage: PackageData | null = pkg
    ? {
        tier: pkg.tier,
        name: pkg.name,
        description: pkg.description,
        priceMonthly: pkg.priceMonthly,
        priceYearly: pkg.priceYearly,
        dailyTaskLimit: pkg.dailyTaskLimit,
        withdrawalFee: pkg.withdrawalFee,
        minWithdrawal: pkg.minWithdrawal,
        features: pkg.features,
        referralBonus: pkg.referralBonus,
        xpMultiplier: pkg.xpMultiplier,
      }
    : null;

  const history: SubscriptionHistoryItem[] = subscriptions.map((s) => ({
    id: s.id,
    packageTier: s.packageTier,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    amount: Number(s.amount),
    paymentMethod: s.paymentMethod,
    isActive: s.isActive,
    autoRenew: s.autoRenew,
    createdAt: s.createdAt.toISOString(),
  }));

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const hasActivePaidSubscription = subscriptions.some(
    (s) =>
      s.isActive &&
      s.packageTier !== "FREE" &&
      new Date(s.endDate).getTime() > nowMs
  );

  return (
    <MyPackageView
      packageTier={user.packageTier}
      packageExpiresAt={user.packageExpiresAt?.toISOString() ?? null}
      currentPackage={currentPackage}
      subscriptions={history}
      hasActivePaidSubscription={hasActivePaidSubscription}
    />
  );
}
