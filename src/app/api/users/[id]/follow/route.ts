import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: targetId } = await params;
  const me = session.user.id;

  if (me === targetId) {
    return NextResponse.json({ error: "Can't follow yourself" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, status: true, name: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.status !== "ACTIVE") {
    return NextResponse.json({ error: "User is not active" }, { status: 400 });
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: me, followingId: targetId } },
  });

  if (existing) {
    // Unfollow
    await prisma.$transaction([
      prisma.follow.delete({ where: { id: existing.id } }),
      prisma.user.update({
        where: { id: me },
        data: { followingCount: { decrement: 1 } },
      }),
      prisma.user.update({
        where: { id: targetId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);
    const counts = await prisma.user.findUnique({
      where: { id: targetId },
      select: { followersCount: true },
    });
    return NextResponse.json({
      following: false,
      followersCount: counts?.followersCount ?? 0,
    });
  }

  // Follow
  const meUser = await prisma.user.findUnique({
    where: { id: me },
    select: { name: true, username: true },
  });
  await prisma.$transaction([
    prisma.follow.create({
      data: { followerId: me, followingId: targetId },
    }),
    prisma.user.update({
      where: { id: me },
      data: { followingCount: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: targetId },
      data: { followersCount: { increment: 1 } },
    }),
    prisma.notification.create({
      data: {
        userId: targetId,
        type: NotificationType.SOCIAL,
        title: "New follower",
        message: `${meUser?.name ?? meUser?.username ?? "Someone"} started following you.`,
        data: { followerId: me },
      },
    }),
  ]);

  const counts = await prisma.user.findUnique({
    where: { id: targetId },
    select: { followersCount: true },
  });
  return NextResponse.json({
    following: true,
    followersCount: counts?.followersCount ?? 0,
  });
}
