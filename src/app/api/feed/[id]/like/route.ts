import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/feed/:id/like - Like a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          userId: session.user.id,
          postId: id,
        },
      },
    });

    if (existingLike) {
      return NextResponse.json(
        { error: "Already liked" },
        { status: 400 }
      );
    }

    // Create like
    await prisma.like.create({
      data: {
        userId: session.user.id,
        postId: id,
      },
    });

    // Update like count
    await prisma.post.update({
      where: { id },
      data: { likesCount: { increment: 1 } },
    });

    // Get updated count
    const likesCount = await prisma.like.count({
      where: { postId: id },
    });

    return NextResponse.json({
      liked: true,
      likesCount,
    });
  } catch (error) {
    console.error("Error liking post:", error);
    return NextResponse.json(
      { error: "Failed to like post" },
      { status: 500 }
    );
  }
}

// DELETE /api/feed/:id/like - Unlike a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if like exists
    const like = await prisma.like.findUnique({
      where: {
        postId_userId: {
          userId: session.user.id,
          postId: id,
        },
      },
    });

    if (!like) {
      return NextResponse.json(
        { error: "Not liked" },
        { status: 400 }
      );
    }

    // Delete like
    await prisma.like.delete({
      where: {
        postId_userId: {
          userId: session.user.id,
          postId: id,
        },
      },
    });

    // Update like count
    await prisma.post.update({
      where: { id },
      data: { likesCount: { decrement: 1 } },
    });

    // Get updated count
    const likesCount = await prisma.like.count({
      where: { postId: id },
    });

    return NextResponse.json({
      liked: false,
      likesCount,
    });
  } catch (error) {
    console.error("Error unliking post:", error);
    return NextResponse.json(
      { error: "Failed to unlike post" },
      { status: 500 }
    );
  }
}
