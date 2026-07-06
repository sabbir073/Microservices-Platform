import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Credit the user for watching a reward ad, enforcing the per-ad cooldown. */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const userId = session.user.id;

  const ad = await prisma.ad.findUnique({ where: { id } });
  if (!ad || ad.status !== "ACTIVE" || ad.rewardPoints <= 0) {
    return NextResponse.json({ error: "Ad not available" }, { status: 400 });
  }

  // Cooldown check against the most recent view.
  const last = await prisma.adView.findFirst({
    where: { userId, adId: id },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const readyAt = last.createdAt.getTime() + ad.rewardCooldownSec * 1000;
    if (Date.now() < readyAt) {
      return NextResponse.json(
        { error: "This ad is on cooldown", cooldownRemaining: Math.ceil((readyAt - Date.now()) / 1000) },
        { status: 429 }
      );
    }
  }

  const points = ad.rewardPoints;

  const [, user] = await prisma.$transaction([
    prisma.adView.create({
      data: { userId, adId: id, rewardedPoints: points },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        pointsBalance: { increment: points },
        totalEarnings: { increment: points * 0.001 },
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.BONUS,
        status: TransactionStatus.COMPLETED,
        points,
        amount: points * 0.001,
        description: "Ad view reward",
        reference: `ad_${id}_${Date.now()}`,
      },
    }),
    prisma.ad.update({ where: { id }, data: { clicks: { increment: 1 } } }),
  ]);

  return NextResponse.json({
    success: true,
    rewarded: points,
    newBalance: user.pointsBalance,
  });
}
