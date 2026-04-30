import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PackagesView } from "@/components/user/packages/packages-view";

export default async function PackagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [packages, user] = await Promise.all([
    prisma.package.findMany({ orderBy: { priceMonthly: "asc" } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { packageTier: true, cashBalance: true, pointsBalance: true },
    }),
  ]);

  return (
    <PackagesView
      packages={packages.map((p) => ({
        id: p.id,
        tier: p.tier,
        name: p.name,
        description: p.description ?? undefined,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly ?? undefined,
        dailyTaskLimit: p.dailyTaskLimit,
        withdrawalFee: p.withdrawalFee,
      }))}
      currentTier={user?.packageTier ?? "FREE"}
      cashBalance={Number(user?.cashBalance ?? 0)}
      pointsBalance={user?.pointsBalance ?? 0}
    />
  );
}
