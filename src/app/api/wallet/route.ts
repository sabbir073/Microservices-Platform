import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WithdrawalStatus } from "@/generated/prisma";

// GET /api/wallet - Get user wallet details
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with balance info
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
        packageTier: true,
        kycStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get pending withdrawal amount
    const pendingWithdrawalsList = await prisma.withdrawal.findMany({
      where: {
        userId: session.user.id,
        status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
      },
      select: { amount: true },
    });
    const pendingWithdrawalsAmount = pendingWithdrawalsList.reduce((sum, w) => sum + w.amount, 0);

    // Get package info for withdrawal limits
    const packageInfo = await prisma.package.findUnique({
      where: { tier: user.packageTier },
      select: {
        name: true,
        minWithdrawal: true,
        withdrawalFee: true,
        dailyTaskLimit: true,
      },
    });

    // Get today's earnings
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get this month's earnings
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Fetch all earning transactions for this month (includes today)
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

    // Get tasks completed today
    const tasksCompletedToday = await prisma.taskSubmission.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: todayStart },
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
      },
    });

    // Calculate available balance (points - pending withdrawals converted)
    const availablePoints = user.pointsBalance - Math.floor(pendingWithdrawalsAmount * 1000);

    return NextResponse.json({
      balance: {
        points: user.pointsBalance,
        availablePoints: Math.max(0, availablePoints),
        cashEquivalent: user.pointsBalance / 1000,
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
        tier: user.packageTier,
        name: packageInfo?.name || user.packageTier,
        minWithdrawal: packageInfo?.minWithdrawal || 5,
        withdrawalFee: packageInfo?.withdrawalFee || 0,
        dailyTaskLimit: packageInfo?.dailyTaskLimit || 10,
      },
      kycStatus: user.kycStatus,
      canWithdraw: user.kycStatus === "APPROVED" && availablePoints >= (packageInfo?.minWithdrawal || 5) * 1000,
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}
