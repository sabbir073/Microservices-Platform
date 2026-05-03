import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  TransactionType,
  TransactionStatus,
} from "@/generated/prisma/client";

const BOOST_COST_POINTS = 100;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, userId: true, isPinned: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (post.userId !== userId) {
    return NextResponse.json(
      { error: "You can only boost your own posts" },
      { status: 403 }
    );
  }
  if (post.isPinned) {
    return NextResponse.json(
      { error: "This post is already boosted" },
      { status: 400 }
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { pointsBalance: true },
  });
  if (!me || me.pointsBalance < BOOST_COST_POINTS) {
    return NextResponse.json(
      { error: `Insufficient points. ${BOOST_COST_POINTS} pts required.` },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { pointsBalance: { decrement: BOOST_COST_POINTS } },
    }),
    prisma.post.update({
      where: { id },
      data: { isPinned: true },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.PURCHASE,
        status: TransactionStatus.COMPLETED,
        points: -BOOST_COST_POINTS,
        amount: BOOST_COST_POINTS / 1000,
        description: "Boosted social post",
        reference: `boost_${id}_${Date.now()}`,
        metadata: { postId: id },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    cost: BOOST_COST_POINTS,
    isPinned: true,
  });
}
