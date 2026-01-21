import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/referrals - Get user's referral dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get user with referral code
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        referralCode: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get referral settings (commission rates)
    const referralLevels = await prisma.referralLevel.findMany({
      where: { isActive: true },
      orderBy: { level: "asc" },
    });

    // Default rates if not configured
    const commissionRates = referralLevels.length > 0
      ? referralLevels.reduce((acc, lvl) => {
          // Store commission value with type indicator
          if (lvl.commissionType === "PERCENTAGE") {
            acc[lvl.level] = lvl.commissionValue;
          } else {
            // For flat rate, store as negative to differentiate (temporary workaround)
            acc[lvl.level] = -lvl.commissionValue;
          }
          return acc;
        }, {} as Record<number, number>)
      : { 1: 10, 2: 5, 3: 2 };

    // Get direct referrals (Level 1)
    const level1Referrals = await prisma.user.findMany({
      where: { referredById: session.user.id },
      select: {
        id: true,
        name: true,
        avatar: true,
        createdAt: true,
        level: true,
        totalEarnings: true,
      },
    });

    // Get Level 2 referrals (referrals of my referrals)
    const level1Ids = level1Referrals.map((r) => r.id);
    const level2Referrals = await prisma.user.findMany({
      where: { referredById: { in: level1Ids } },
      select: {
        id: true,
        name: true,
        avatar: true,
        createdAt: true,
        level: true,
        totalEarnings: true,
        referredById: true,
      },
    });

    // Get Level 3 referrals
    const level2Ids = level2Referrals.map((r) => r.id);
    const level3Referrals = await prisma.user.findMany({
      where: { referredById: { in: level2Ids } },
      select: {
        id: true,
        name: true,
        avatar: true,
        createdAt: true,
        level: true,
        totalEarnings: true,
        referredById: true,
      },
    });

    // Get all referral earnings for this user
    const allEarnings = await prisma.referralEarning.findMany({
      where: { userId: session.user.id },
      select: { level: true, amount: true, createdAt: true },
    });

    // Calculate earnings by level
    const earningsByLevel: Record<number, { amount: number; count: number }> = {};
    allEarnings.forEach((e) => {
      if (!earningsByLevel[e.level]) {
        earningsByLevel[e.level] = { amount: 0, count: 0 };
      }
      earningsByLevel[e.level].amount += e.amount;
      earningsByLevel[e.level].count++;
    });

    // Calculate total earnings
    const totalEarningsAmount = allEarnings.reduce((sum, e) => sum + e.amount, 0);

    // Get this month's earnings
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEarningsAmount = allEarnings
      .filter((e) => e.createdAt >= monthStart)
      .reduce((sum, e) => sum + e.amount, 0);

    // Get recent referral activities
    const recentActivities = await prisma.referralEarning.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        level: true,
        amount: true,
        sourceType: true,
        createdAt: true,
      },
    });

    // Determine which level's referrals to return based on filter
    let referralsToShow;
    let referralLevel = 1;
    let totalReferrals = level1Referrals.length + level2Referrals.length + level3Referrals.length;

    if (level === "2") {
      referralsToShow = level2Referrals;
      referralLevel = 2;
    } else if (level === "3") {
      referralsToShow = level3Referrals;
      referralLevel = 3;
    } else if (level === "all") {
      referralsToShow = [
        ...level1Referrals.map((r) => ({ ...r, referralLevel: 1 })),
        ...level2Referrals.map((r) => ({ ...r, referralLevel: 2 })),
        ...level3Referrals.map((r) => ({ ...r, referralLevel: 3 })),
      ];
      referralLevel = 0;
    } else {
      referralsToShow = level1Referrals;
      referralLevel = 1;
    }

    // Paginate
    const paginatedReferrals = referralsToShow.slice(skip, skip + limit);

    return NextResponse.json({
      referralCode: user.referralCode,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://earngpt.com"}/register?ref=${user.referralCode}`,
      commissionRates,
      stats: {
        totalReferrals,
        level1Count: level1Referrals.length,
        level2Count: level2Referrals.length,
        level3Count: level3Referrals.length,
        totalEarnings: totalEarningsAmount,
        monthEarnings: monthEarningsAmount,
        earningsByLevel,
      },
      referrals: paginatedReferrals.map((r) => ({
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        joinedAt: r.createdAt,
        level: "referralLevel" in r ? r.referralLevel : referralLevel,
        userLevel: r.level,
        totalEarnings: r.totalEarnings,
      })),
      pagination: {
        page,
        limit,
        total: referralsToShow.length,
        totalPages: Math.ceil(referralsToShow.length / limit),
      },
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        level: a.level,
        amount: a.amount,
        sourceType: a.sourceType,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return NextResponse.json(
      { error: "Failed to fetch referrals" },
      { status: 500 }
    );
  }
}
