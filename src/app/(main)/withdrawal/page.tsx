import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WithdrawalView } from "@/components/user/wallet/withdrawal-view";
import { getUiToggles } from "@/lib/ui-toggles-server";

export default async function WithdrawalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, methods, toggles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        cashBalance: true,
        pointsBalance: true,
        kycStatus: true,
        package: { select: { slug: true } },
      },
    }),
    prisma.userPaymentMethod.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    getUiToggles(),
  ]);

  return (
    <WithdrawalView
      cashBalance={Number(user?.cashBalance ?? 0)}
      pointsBalance={user?.pointsBalance ?? 0}
      packageTier={user?.package?.slug ?? "default"}
      kycStatus={user?.kycStatus ?? "NOT_SUBMITTED"}
      requireKyc={toggles.requireKycForWithdrawal}
      methods={methods.map((m) => ({
        id: m.id,
        type: m.method,
        label: m.accountName ?? `${m.method} · ${m.accountNumber}`,
        isDefault: m.isDefault,
      }))}
    />
  );
}
