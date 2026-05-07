import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SocialFeedView } from "@/components/user/feed/social-feed-view";
import type { BannerSlide } from "@/components/user/primitives/banner-slider";
import { getTickerPayload } from "@/lib/ticker-server";

export default async function SocialPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const now = new Date();

  const [bannerRows, tickerPayload] = await Promise.all([
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
      take: 5,
    }),
    getTickerPayload(),
  ]);

  const banners: BannerSlide[] = bannerRows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle ?? undefined,
    imageUrl: b.imageUrl ?? undefined,
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
