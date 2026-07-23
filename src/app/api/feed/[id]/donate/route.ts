import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  TransactionType,
  TransactionStatus,
  NotificationType,
} from "@/generated/prisma/client";
import { z } from "zod";
import { getPointsPerUsd } from "@/lib/economy";

const schema = z.object({
  points: z.number().int().min(1).max(100000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const donorId = session.user.id;

  const { id } = await params;
  const body = await req.json();
  const v = schema.safeParse(body);
  if (!v.success) {
    return NextResponse.json(
      { error: "Invalid input", details: v.error.issues },
      { status: 400 }
    );
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      donationGoal: true,
      donationCollected: true,
      content: true,
    },
  });
  if (!post || !post.donationGoal) {
    return NextResponse.json(
      { error: "This post doesn't accept donations" },
      { status: 404 }
    );
  }
  if (post.userId === donorId) {
    return NextResponse.json(
      { error: "You can't donate to your own post" },
      { status: 400 }
    );
  }

  const donor = await prisma.user.findUnique({
    where: { id: donorId },
    select: { pointsBalance: true },
  });
  if (!donor || donor.pointsBalance < v.data.points) {
    return NextResponse.json(
      { error: "Insufficient points balance" },
      { status: 400 }
    );
  }

  const pointsPerUsd = await getPointsPerUsd();
  const [, , , donation, updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: donorId },
      data: { pointsBalance: { decrement: v.data.points } },
    }),
    prisma.user.update({
      where: { id: post.userId },
      data: {
        pointsBalance: { increment: v.data.points },
        totalEarnings: { increment: v.data.points / pointsPerUsd },
      },
    }),
    prisma.transaction.create({
      data: {
        userId: donorId,
        type: TransactionType.PURCHASE,
        status: TransactionStatus.COMPLETED,
        points: -v.data.points,
        amount: v.data.points / pointsPerUsd,
        description: `Donation to post`,
        reference: `donation_${id}_${Date.now()}`,
        metadata: { postId: id, recipientId: post.userId },
      },
    }),
    prisma.donation.create({
      data: {
        postId: id,
        donorId,
        points: v.data.points,
      },
    }),
    prisma.post.update({
      where: { id },
      data: { donationCollected: { increment: v.data.points } },
      select: { donationCollected: true, donationGoal: true },
    }),
  ]);

  await prisma.notification.create({
    data: {
      userId: post.userId,
      type: NotificationType.WALLET,
      title: "💝 New donation",
      message: `Someone donated ${v.data.points} pts to your post.`,
      data: { postId: id, points: v.data.points, donationId: donation.id },
    },
  });

  return NextResponse.json({
    success: true,
    donationId: donation.id,
    donationCollected: updated.donationCollected,
    donationGoal: updated.donationGoal,
  });
}
