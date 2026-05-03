import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  TransactionType,
  TransactionStatus,
  NotificationType,
} from "@/generated/prisma/client";

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

const DEFAULT_DAILY_PER_REFERRAL = 5; // points per L1 referral, used if Package.referralBonus is 0

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, packageTier: true },
  });
  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const today = utcDateKey();
  const existing = await prisma.dailyReferralClaim.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  // L1 referral count
  const referralCount = await prisma.user.count({
    where: { referredById: userId },
  });

  // Per-referral bonus from package (fallback to default)
  const pkg = await prisma.package.findUnique({
    where: { tier: me.packageTier },
    select: { referralBonus: true },
  });
  const perReferral = pkg?.referralBonus && pkg.referralBonus > 0
    ? pkg.referralBonus
    : DEFAULT_DAILY_PER_REFERRAL;
  const points = Math.round(perReferral * referralCount);

  // Mission gating
  const mission = await prisma.dailyMissionTemplate.findFirst({
    where: {
      packageTier: me.packageTier,
      isActive: true,
      linkReferralBonus: true,
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  let missionRequired = false;
  let missionComplete = false;
  if (mission) {
    missionRequired = true;
    const claim = await prisma.dailyMissionClaim.findUnique({
      where: {
        userId_missionId_date: {
          userId,
          missionId: mission.id,
          date: today,
        },
      },
    });
    missionComplete = !!claim;
  }

  return NextResponse.json({
    points,
    perReferral,
    referralCount,
    canClaim: !existing && referralCount > 0 && (!missionRequired || missionComplete),
    claimed: !!existing,
    missionRequired,
    missionComplete,
    missionId: mission?.id ?? null,
    today,
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, packageTier: true },
  });
  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const today = utcDateKey();

  const existing = await prisma.dailyReferralClaim.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already claimed today's referral bonus" },
      { status: 400 }
    );
  }

  const referralCount = await prisma.user.count({
    where: { referredById: userId },
  });
  if (referralCount === 0) {
    return NextResponse.json(
      { error: "You don't have any referrals yet" },
      { status: 400 }
    );
  }

  // Mission gate
  const mission = await prisma.dailyMissionTemplate.findFirst({
    where: {
      packageTier: me.packageTier,
      isActive: true,
      linkReferralBonus: true,
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: { id: true, name: true },
  });
  if (mission) {
    const missionClaim = await prisma.dailyMissionClaim.findUnique({
      where: {
        userId_missionId_date: {
          userId,
          missionId: mission.id,
          date: today,
        },
      },
    });
    if (!missionClaim) {
      return NextResponse.json(
        {
          error: `Complete today's daily mission "${mission.name}" first to unlock the referral bonus.`,
        },
        { status: 400 }
      );
    }
  }

  const pkg = await prisma.package.findUnique({
    where: { tier: me.packageTier },
    select: { referralBonus: true },
  });
  const perReferral = pkg?.referralBonus && pkg.referralBonus > 0
    ? pkg.referralBonus
    : DEFAULT_DAILY_PER_REFERRAL;
  const points = Math.round(perReferral * referralCount);
  const cashAmount = points / 1000;

  await prisma.$transaction([
    prisma.dailyReferralClaim.create({
      data: { userId, date: today, points, amount: cashAmount },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        pointsBalance: { increment: points },
        totalEarnings: { increment: cashAmount },
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.REFERRAL,
        status: TransactionStatus.COMPLETED,
        points,
        amount: cashAmount,
        description: `Daily referral bonus (${referralCount} referrals × ${perReferral} pts)`,
        reference: `daily_referral_${today}_${userId}`,
        metadata: { referralCount, perReferral, date: today },
      },
    }),
    prisma.notification.create({
      data: {
        userId,
        type: NotificationType.REFERRAL,
        title: "💸 Daily referral bonus claimed",
        message: `You earned ${points} pts from ${referralCount} active referrals.`,
        data: { points, referralCount, date: today },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    points,
    referralCount,
    perReferral,
    date: today,
  });
}
