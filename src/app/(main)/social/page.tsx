import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SocialFeedView } from "@/components/user/feed/social-feed-view";
import type { BannerSlide } from "@/components/user/primitives/banner-slider";
import { getTickerPayload } from "@/lib/ticker-server";
import { getTrendingHashtags } from "@/lib/trending";

export default async function SocialPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const now = new Date();
  const userId = session.user.id;

  const followingIds = (
    await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    })
  ).map((f) => f.followingId);

  const [bannerRows, tickerPayload, bestEarnersRaw, whoToFollowRows, trendingHashtags] =
    await Promise.all([
      prisma.banner.findMany({
        where: {
          isActive: true,
          location: { in: ["HOME", "ALL"] },
          OR: [
            { startsAt: null, endsAt: null },
            { startsAt: { lte: now }, endsAt: null },
            { startsAt: null, endsAt: { gte: now } },
            { startsAt: { lte: now }, endsAt: { gte: now } },
          ],
        },
        orderBy: { order: "asc" },
        take: 30,
        // Banners change rarely — serve from Accelerate cache.
        cacheStrategy: { ttl: 300, swr: 600 },
      }),
      getTickerPayload(),
      // Cheap "top earners" (no 500-user combined-score scan) — cached.
      prisma.user.findMany({
        orderBy: { totalEarnings: "desc" },
        take: 5,
        select: { id: true, name: true, avatar: true, level: true, totalEarnings: true },
        cacheStrategy: { ttl: 60, swr: 120 },
      }),
      prisma.user.findMany({
        where: { id: { notIn: [userId, ...followingIds] } },
        orderBy: [{ followersCount: "desc" }, { totalEarnings: "desc" }],
        take: 5,
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          level: true,
          isBlueVerified: true,
          followersCount: true,
        },
        cacheStrategy: { ttl: 60, swr: 120 },
      }),
      getTrendingHashtags(6),
    ]);

  const bestEarners = bestEarnersRaw.map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    level: r.level,
  }));

  const promoRow = bannerRows[0];
  const promo = promoRow
    ? {
        title: promoRow.title,
        subtitle: promoRow.subtitle,
        bgGradient: promoRow.bgGradient,
        linkUrl: promoRow.linkUrl,
      }
    : null;

  const banners: BannerSlide[] = bannerRows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle ?? undefined,
    imageUrl: b.imageUrl ?? undefined,
    videoUrl: b.videoUrl ?? undefined,
    ctaLabel: b.linkUrl ? "Open" : undefined,
    ctaHref: b.linkUrl ?? undefined,
    bgGradient: b.bgGradient ?? undefined,
  }));

  return (
    <SocialFeedView
      user={{
        id: session.user.id,
        name: session.user.name ?? null,
        avatar: session.user.image ?? null,
        role: session.user.role ?? null,
      }}
      initialBanners={banners}
      bestEarners={bestEarners}
      whoToFollow={whoToFollowRows}
      trendingHashtags={trendingHashtags}
      promo={promo}
      initialTicker={tickerPayload?.items ?? []}
      tickerConfig={
        tickerPayload
          ? {
              showAmount: tickerPayload.config.show_amount,
              showMethod: tickerPayload.config.show_method,
              showCountry: tickerPayload.config.show_country,
              speedSec: Math.max(
                5,
                Math.round(tickerPayload.config.scroll_speed_ms / 1000)
              ),
            }
          : undefined
      }
    />
  );
}
