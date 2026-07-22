import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WithdrawalStatus } from "@/generated/prisma";
import { getSubscriptionStatus } from "@/lib/packages";
import { getPointsPerUsd } from "@/lib/economy";

// GET /api/wallet - Get user wallet details
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        pointsBalance: true,
        cashBalance: true,
        totalEarnings: true,
        totalWithdrawals: true,
        level: true,
        xp: true,
        kycStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Resolve the user's effective plan + raw expiry status (for the renew banner).
    const sub = await getSubscriptionStatus(session.user.id);

    const pendingWithdrawalsList = await prisma.withdrawal.findMany({
      where: {
        userId: session.user.id,
        status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
      },
      select: { amount: true },
    });
    const pendingWithdrawalsAmount = pendingWithdrawalsList.reduce((sum, w) => sum + w.amount, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: "EARNING",
        status: "COMPLETED",
        createdAt: { gte: monthStart },
      },
      select: { points: true, createdAt: true },
    });

    const todayEarningsPoints = monthTransactions
      .filter((t) => t.createdAt >= todayStart)
      .reduce((sum, t) => sum + (t.points || 0), 0);

    const monthEarningsPoints = monthTransactions.reduce((sum, t) => sum + (t.points || 0), 0);

    const tasksCompletedToday = await prisma.taskSubmission.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: todayStart },
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
      },
    });

    const pointsPerUsd = await getPointsPerUsd();
    const availablePoints = user.pointsBalance - Math.floor(pendingWithdrawalsAmount * pointsPerUsd);

    const pkg = sub.effective;

    return NextResponse.json({
      balance: {
        points: user.pointsBalance,
        availablePoints: Math.max(0, availablePoints),
        cashEquivalent: user.pointsBalance / pointsPerUsd,
        pendingWithdrawal: pendingWithdrawalsAmount,
        totalEarnings: user.totalEarnings,
        totalWithdrawals: user.totalWithdrawals,
      },
      stats: {
        todayEarnings: todayEarningsPoints,
        monthEarnings: monthEarningsPoints,
        tasksCompletedToday,
        level: user.level,
        xp: user.xp,
      },
      package: {
        id: pkg?.id ?? null,
        slug: pkg?.slug ?? null,
        name: pkg?.name ?? "Free",
        accessLevel: pkg?.accessLevel ?? 0,
        minWithdrawal: pkg?.minWithdrawal ?? 5,
        withdrawalFeeDiscount: pkg?.withdrawalFeeDiscount ?? 0,
        dailyTaskLimit: pkg?.dailyTaskLimit ?? -1,
        // Subscription status — UI can render a "Renew" banner.
        rawPackageId: sub.rawPackageId,
        expired: sub.expired,
        expiresAt: sub.expiresAt,
      },
      kycStatus: user.kycStatus,
      canWithdraw:
        !!pkg?.withdrawalsEnabled &&
        user.kycStatus === "APPROVED" &&
        availablePoints >= (pkg?.minWithdrawal ?? 5) * pointsPerUsd,
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}
