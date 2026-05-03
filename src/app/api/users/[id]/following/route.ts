import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/[id]/following?limit=20&cursor=<id>
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
    where: { followerId: id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      following: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          isBlueVerified: true,
          followersCount: true,
        },
      },
    },
  });
  type WithFollowing = (typeof follows)[number] & {
    following: {
      id: string;
      name: string | null;
      username: string | null;
      avatar: string | null;
      isBlueVerified: boolean;
      followersCount: number;
    };
  };
  const rows = follows as WithFollowing[];

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1].id : null;

  const ids = slice.map((f) => f.following.id);
  const myFollows = ids.length
    ? await prisma.follow.findMany({
        where: { followerId: session.user.id, followingId: { in: ids } },
        select: { followingId: true },
      })
    : [];
  const followingSet = new Set(myFollows.map((f) => f.followingId));

  return NextResponse.json({
    items: slice.map((f) => ({
      id: f.following.id,
      name: f.following.name,
      username: f.following.username,
      avatar: f.following.avatar,
      isBlueVerified: f.following.isBlueVerified,
      followersCount: f.following.followersCount,
      isFollowing: followingSet.has(f.following.id),
      followedAt: f.createdAt,
    })),
    nextCursor,
  });
}
