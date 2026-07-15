import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/advertiser/posts — the caller's own posts, for the promote-a-post
// picker in the create-ad flow.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posts = await prisma.post.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      content: true,
      images: true,
      likesCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      content: p.content,
      image: p.images?.[0] ?? null,
      likesCount: p.likesCount,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
