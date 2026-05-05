import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardSocialEarning } from "@/lib/social-earning";

// POST /api/feed/[id]/view — record a unique view per (postId, viewerId).
// Idempotent: re-fires from the same user are no-ops.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const viewerId = session.user.id;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, userId: true, viewsCount: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Self-views excluded
  if (post.userId === viewerId) {
    return NextResponse.json({
      counted: false,
      viewsCount: post.viewsCount,
      reason: "self",
    });
  }

  // Idempotent insert
  try {
    await prisma.$transaction([
      prisma.postView.create({
        data: { postId: id, userId: viewerId },
      }),
      prisma.post.update({
        where: { id },
        data: { viewsCount: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Already viewed → silently succeed
    if (msg.includes("Unique constraint") || msg.includes("duplicate key")) {
      return NextResponse.json({
        counted: false,
        viewsCount: post.viewsCount,
        reason: "already_viewed",
      });
    }
    throw err;
  }

  // Award the post owner (and optionally the viewer if actor side enabled)
  await awardSocialEarning({
    postOwnerUserId: post.userId,
    actorUserId: viewerId,
    action: "VIEW_RECEIVED",
    postId: id,
  });

  const updated = await prisma.post.findUnique({
    where: { id },
    select: { viewsCount: true },
  });
  return NextResponse.json({
    counted: true,
    viewsCount: updated?.viewsCount ?? post.viewsCount + 1,
  });
}
