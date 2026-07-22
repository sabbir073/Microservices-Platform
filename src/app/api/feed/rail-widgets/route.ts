import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildDailyProgress,
  resolveTaskTypeBucket,
} from "@/lib/daily-mission-progress";

/**
 * One-shot summary for the social feed right rail's earn widgets — merges the
 * balance (/api/wallet), login streak (/api/daily-reward), daily-mission
 * progress (/api/daily-mission/today) and referral (/api/referrals) into a
 * single round-trip so the rail doesn't fire four requests on mount.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      level: true,
      pointsBalance: true,
      streak: true,
      lastCheckIn: true,
      referralCode: true,
      package: { select: { accessLevel: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayAgg = await prisma.transaction.aggregate({
    // Today's earnings (points) — completed EARNING/BONUS transactions today.
    where: {
      userId,
      status: "COMPLETED",
      type: { in: ["EARNING", "BONUS"] },
      createdAt: { gte: todayStart },
    },
    _sum: { points: true },
  });
  const referralCount = await prisma.user.count({
    where: { referredById: userId },
  });
  // Highest-accessLevel active mission template the user qualifies for.
  const missionRaw = await prisma.dailyMissionTemplate.findFirst({
    where: {
      requiredAccessLevel: { lte: user.package?.accessLevel ?? 0 },
      isActive: true,
      requiredLevel: { lte: user.level },
    },
    orderBy: [
      { requiredAccessLevel: "desc" },
      { order: "asc" },
      { createdAt: "desc" },
    ],
    include: { items: { orderBy: { order: "asc" } } },
  });

  // Login-streak status (mirror of /api/daily-reward GET day-diff logic).
  let currentStreak = user.streak || 0;
  let canClaim = true;
  if (user.lastCheckIn) {
    const lastDay = new Date(user.lastCheckIn);
    lastDay.setHours(0, 0, 0, 0);
    const days = Math.floor(
      (todayStart.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) canClaim = false;
    else if (days > 1) currentStreak = 0;
  }

  // Daily-mission progress (reuses the same builder as the mission page).
  // The Accelerate client doesn't surface the `include: { items }` payload in
  // the inferred type, so narrow it explicitly (mirrors the today route).
  type MissionItem = { taskType: string; targetCount: number };
  const missionItems =
    (missionRaw as unknown as { items: MissionItem[] } | null)?.items ?? [];
  let mission: {
    done: number;
    total: number;
    claimedToday: boolean;
  } | null = null;
  if (missionRaw && missionItems.length) {
    const countByType = await buildDailyProgress(userId, missionItems);
    const done = missionItems.filter(
      (it) =>
        (countByType[resolveTaskTypeBucket(it.taskType)] ?? 0) >=
        it.targetCount
    ).length;
    const claim = await prisma.dailyMissionClaim.findUnique({
      where: {
        userId_missionId_date: {
          userId,
          missionId: missionRaw.id,
          date: new Date().toISOString().slice(0, 10),
        },
      },
      select: { id: true },
    });
    mission = {
      done,
      total: missionItems.length,
      claimedToday: !!claim,
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://earngpt.app";

  return NextResponse.json({
    balance: {
      points: user.pointsBalance,
      todayEarnings:
        (todayAgg as { _sum?: { points: number | null } })._sum?.points ?? 0,
    },
    streak: { current: currentStreak, canClaim },
    mission,
    referral: {
      code: user.referralCode,
      link: user.referralCode
        ? `${appUrl}/register?ref=${user.referralCode}`
        : null,
      totalReferrals: referralCount,
    },
  });
}
