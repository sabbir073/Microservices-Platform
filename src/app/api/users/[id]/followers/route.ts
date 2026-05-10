import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/[id]/followers?limit=20&cursor=<id>
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const cursor = searchParams.get("cursor");

  const follows = await prisma.follow.findMany({
    where: { followingId: id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      follower: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          isBlueVerified: true,
          verifiedBadgeStyle: true,
          followersCount: true,
          displayFollowersBoost: true,
        },
      },
    },
  });
  type WithFollower = (typeof follows)[number] & {
    follower: {
      id: string;
      name: string | null;
      username: string | null;
      avatar: string | null;
      isBlueVerified: boolean;
      verifiedBadgeStyle: string | null;
      followersCount: number;
      displayFollowersBoost: number;
    };
  };
  const rows = follows as WithFollower[];

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1].id : null;

  // Which of these does the viewer already follow?
  const ids = slice.map((f) => f.follower.id);
  const myFollows = ids.length
    ? await prisma.follow.findMany({
        where: { followerId: session.user.id, followingId: { in: ids } },
        select: { followingId: true },
      })
    : [];
  const followingSet = new Set(myFollows.map((f) => f.followingId));

  return NextResponse.json({
    items: slice.map((f) => ({
      id: f.follower.id,
      name: f.follower.name,
      username: f.follower.username,
      avatar: f.follower.avatar,
      isBlueVerified: f.follower.isBlueVerified,
      verifiedBadgeStyle: f.follower.verifiedBadgeStyle ?? "BLUE",
      followersCount: Math.max(
        0,
        f.follower.followersCount + f.follower.displayFollowersBoost
      ),
      isFollowing: followingSet.has(f.follower.id),
      followedAt: f.createdAt,
    })),
    nextCursor,
  });
}
