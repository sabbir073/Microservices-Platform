import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/[id]/profile — public profile data, honors privacy settings.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      coverPhoto: true,
      bio: true,
      country: true,
      tags: true,
      level: true,
      isBlueVerified: true,
      packageTier: true,
      status: true,
      privacyAvatar: true,
      privacyBio: true,
      privacyStats: true,
      privacyEarnings: true,
      privacyLocation: true,
      followersCount: true,
      followingCount: true,
      createdAt: true,
    },
  });

  if (!u) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isMe = u.id === session.user.id;

  // Is the viewer following this user?
  let isFollowing = false;
  let isFollowedBy = false;
  if (!isMe) {
    const [f1, f2] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: u.id,
          },
        },
        select: { id: true },
      }),
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: u.id,
            followingId: session.user.id,
          },
        },
        select: { id: true },
      }),
    ]);
    isFollowing = !!f1;
    isFollowedBy = !!f2;
  }

  // Privacy gates
  const showByPrivacy = (level: string): boolean => {
    if (isMe) return true;
    if (level === "PUBLIC") return true;
    if (level === "PRIVATE") return false;
    if (level === "FRIENDS") return isFollowing && isFollowedBy; // mutual
    return true;
  };

  const postsCount = await prisma.post.count({
    where: { userId: u.id, isPublic: true },
  });

  return NextResponse.json({
    user: {
      id: u.id,
      name: u.name,
      username: u.username,
      avatar: showByPrivacy(u.privacyAvatar) ? u.avatar : null,
      coverPhoto: u.coverPhoto,
      bio: showByPrivacy(u.privacyBio) ? u.bio : null,
      country: showByPrivacy(u.privacyLocation) ? u.country : null,
      tags: u.tags,
      level: u.level,
      isBlueVerified: u.isBlueVerified,
      packageTier: u.packageTier,
      createdAt: u.createdAt,
      // Stats — gated by privacyStats
      postsCount: showByPrivacy(u.privacyStats) ? postsCount : null,
      followersCount: showByPrivacy(u.privacyStats) ? u.followersCount : null,
      followingCount: showByPrivacy(u.privacyStats) ? u.followingCount : null,
    },
    viewer: {
      isMe,
      isFollowing,
      isFollowedBy,
    },
  });
}
