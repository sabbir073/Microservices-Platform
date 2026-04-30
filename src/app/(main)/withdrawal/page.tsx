import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WithdrawalView } from "@/components/user/wallet/withdrawal-view";

export default async function WithdrawalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, methods] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        cashBalance: true,
        pointsBalance: true,
        packageTier: true,
      },
    }),
    prisma.userPaymentMethod.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <WithdrawalView
      cashBalance={Number(user?.cashBalance ?? 0)}
      pointsBalance={user?.pointsBalance ?? 0}
      packageTier={user?.packageTier ?? "FREE"}
      methods={methods.map((m) => ({
        id: m.id,
        type: m.method,
        label: m.accountName ?? `${m.method} · ${m.accountNumber}`,
        isDefault: m.isDefault,
      }))}
    />
  );
}
