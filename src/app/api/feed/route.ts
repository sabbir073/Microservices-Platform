import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardSocialEarning } from "@/lib/social-earning";
import { extractMentionUsernames, resolveMentionedUsers } from "@/lib/mentions";

// GET /api/feed - Get feed posts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const userId = searchParams.get("userId"); // For user profile posts
    const skip = (page - 1) * limit;

    // Build query
    const where: Record<string, unknown> = {
      isPublic: true,
    };

    if (userId) {
      where.userId = userId;
    }

    // Get posts
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    // Get post users
    const userIds = [...new Set(posts.map((p) => p.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        level: true,
        packageTier: true,
        isBlueVerified: true,
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Check if current user has liked each post
    let userLikes: Set<string> = new Set();
    let followingSet: Set<string> = new Set();
    if (session?.user?.id) {
      const likes = await prisma.like.findMany({
        where: {
          userId: session.user.id,
          postId: { in: posts.map((p) => p.id) },
        },
        select: { postId: true },
      });
      userLikes = new Set(likes.map((l) => l.postId));

      // Which post-authors does the viewer already follow?
      if (userIds.length > 0) {
        const follows = await prisma.follow.findMany({
          where: {
            followerId: session.user.id,
            followingId: { in: userIds },
          },
          select: { followingId: true },
        });
        followingSet = new Set(follows.map((f) => f.followingId));
      }
    }

    // Capture user's votes for polls
    let userVoteMap = new Map<string, string>();
    if (session?.user?.id) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: session.user.id,
          postId: { in: posts.map((p) => p.id) },
        },
        select: { postId: true, optionId: true },
      });
      userVoteMap = new Map(votes.map((v) => [v.postId, v.optionId]));
    }

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      content: post.content,
      images: post.images,
      isPublic: post.isPublic,
      isPinned: post.isPinned,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      sharesCount: post.sharesCount,
      viewsCount: post.viewsCount,
      pollOptions: post.pollOptions ?? null,
      pollEndsAt: post.pollEndsAt,
      donationGoal: post.donationGoal,
      donationCollected: post.donationCollected,
      groupId: post.groupId,
      myVote: userVoteMap.get(post.id) ?? null,
      createdAt: post.createdAt,
      user: userMap.get(post.userId),
      isLiked: userLikes.has(post.id),
      isOwner: session?.user?.id === post.userId,
      isFollowingAuthor: followingSet.has(post.userId),
    }));

    return NextResponse.json({
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}

// POST /api/feed - Create a new post
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      content,
      images,
      isPublic,
      pollOptions,
      pollEndsAt,
      donationGoal,
      groupId,
    } = body as {
      content?: string;
      images?: string[];
      isPublic?: boolean;
      pollOptions?: { label: string }[];
      pollEndsAt?: string;
      donationGoal?: number;
      groupId?: string | null;
    };

    // Validate content
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Post content is required" },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Post content cannot exceed 2000 characters" },
        { status: 400 }
      );
    }

    // Build poll structure if provided
    let formattedPoll: { id: string; label: string; voteCount: number }[] | null =
      null;
    if (Array.isArray(pollOptions) && pollOptions.length >= 2) {
      formattedPoll = pollOptions.slice(0, 8).map((o, i) => ({
        id: `opt_${i}`,
        label: String(o.label ?? "").trim().slice(0, 100),
        voteCount: 0,
      }));
      if (formattedPoll.some((o) => !o.label)) {
        return NextResponse.json(
          { error: "Each poll option needs a label" },
          { status: 400 }
        );
      }
    }

    // If posting to a group, ensure user is a member
    if (groupId) {
      const member = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: { groupId, userId: session.user.id },
        },
      });
      if (!member) {
        return NextResponse.json(
          { error: "You must be a group member to post here" },
          { status: 403 }
        );
      }
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content: content.trim(),
        images: images || [],
        isPublic: isPublic !== false,
        pollOptions: formattedPoll ?? undefined,
        pollEndsAt: pollEndsAt ? new Date(pollEndsAt) : null,
        donationGoal:
          typeof donationGoal === "number" && donationGoal > 0
            ? Math.round(donationGoal)
            : null,
        groupId: groupId ?? null,
      },
    });

    // Social earning — author gets daily post-create bonus (capped 1×/day via reference)
    await awardSocialEarning({
      postOwnerUserId: session.user.id,
      actorUserId: session.user.id,
      action: "POST_CREATE",
      postId: post.id,
    });

    // Mentions in the post body
    const usernames = extractMentionUsernames(post.content);
    if (usernames.length > 0) {
      const mentionedUsers = await resolveMentionedUsers(usernames);
      const filtered = mentionedUsers.filter((m) => m.id !== session.user!.id);
      if (filtered.length > 0) {
        await Promise.all(
          filtered.map((m) =>
            prisma.mention.create({
              data: {
                postId: post.id,
                mentionedUserId: m.id,
                mentionedById: session.user!.id,
              },
            })
          )
        );
        for (const m of filtered) {
          await awardSocialEarning({
            postOwnerUserId: m.id,
            actorUserId: session.user!.id,
            action: "MENTION_RECEIVED",
            postId: post.id,
          });
        }
      }
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        level: true,
        packageTier: true,
        isBlueVerified: true,
      },
    });

    return NextResponse.json({
      post: {
        id: post.id,
        content: post.content,
        images: post.images,
        isPublic: post.isPublic,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
        isFollowingAuthor: false,
        pollOptions: post.pollOptions,
        pollEndsAt: post.pollEndsAt,
        donationGoal: post.donationGoal,
        donationCollected: post.donationCollected,
        groupId: post.groupId,
        myVote: null,
        createdAt: post.createdAt,
        user,
        isLiked: false,
        isOwner: true,
      },
      message: "Post created successfully",
    });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
