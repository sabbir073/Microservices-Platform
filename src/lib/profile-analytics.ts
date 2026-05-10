import { prisma } from "@/lib/prisma";

export interface ProfileAnalytics {
  totals: {
    posts: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    earnings: number;
  };
  topPosts: Array<{
    id: string;
    content: string;
    thumbnail: string | null;
    viewsCount: number;
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    createdAt: Date | string;
  }>;
  viewsByDay: { date: string; views: number }[];
}

/** Aggregate post analytics for any user. Used by both the user-self endpoint
 *  (`/api/profile/analytics`) and the admin endpoint
 *  (`/api/admin/users/[id]/analytics`). */
export async function getUserAnalytics(userId: string): Promise<ProfileAnalytics> {
  const totals = await prisma.post.aggregate({
    where: { userId },
    _count: { _all: true },
    _sum: {
      viewsCount: true,
      likesCount: true,
      commentsCount: true,
      sharesCount: true,
      socialEarnings: true,
    },
  });

  const topPosts = await prisma.post.findMany({
    where: { userId },
    orderBy: [{ viewsCount: "desc" }, { likesCount: "desc" }],
    take: 5,
    select: {
      id: true,
      content: true,
      images: true,
      viewsCount: true,
      likesCount: true,
      commentsCount: true,
      sharesCount: true,
      createdAt: true,
    },
  });

  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const userPosts = await prisma.post.findMany({
    where: { userId },
    select: { id: true },
  });
  const postIds = userPosts.map((p) => p.id);

  const buckets = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  if (postIds.length > 0) {
    const recentViews = await prisma.postView.findMany({
      where: { postId: { in: postIds }, viewedAt: { gte: since } },
      select: { viewedAt: true },
    });
    for (const v of recentViews) {
      const key = v.viewedAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }

  const viewsByDay = Array.from(buckets.entries()).map(([date, views]) => ({
    date,
    views,
  }));

  return {
    totals: {
      posts: totals._count._all,
      views: totals._sum.viewsCount ?? 0,
      likes: totals._sum.likesCount ?? 0,
      comments: totals._sum.commentsCount ?? 0,
      shares: totals._sum.sharesCount ?? 0,
      earnings: totals._sum.socialEarnings ?? 0,
    },
    topPosts: topPosts.map((p) => ({
      id: p.id,
      content: p.content?.slice(0, 200) ?? "",
      thumbnail: p.images?.[0] ?? null,
      viewsCount: p.viewsCount,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
      sharesCount: p.sharesCount,
      createdAt: p.createdAt,
    })),
    viewsByDay,
  };
}
