import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        avatar: true,
        level: true,
        packageTier: true,
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Check if current user has liked each post
    let userLikes: Set<string> = new Set();
    if (session?.user?.id) {
      const likes = await prisma.like.findMany({
        where: {
          userId: session.user.id,
          postId: { in: posts.map((p) => p.id) },
        },
        select: { postId: true },
      });
      userLikes = new Set(likes.map((l) => l.postId));
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
      createdAt: post.createdAt,
      user: userMap.get(post.userId),
      isLiked: userLikes.has(post.id),
      isOwner: session?.user?.id === post.userId,
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
    const { content, images, isPublic } = body;

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

    // Create post
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content: content.trim(),
        images: images || [],
        isPublic: isPublic !== false,
      },
    });

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        avatar: true,
        level: true,
        packageTier: true,
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
