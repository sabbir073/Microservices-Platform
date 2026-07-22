import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getEffectivePackage } from "@/lib/packages";
import { getAdClickCost } from "@/lib/ad-billing";
import { matchesTargeting, type TargetableUser } from "@/lib/ad-targeting";

// GET /api/ads/feed?count=N&exclude=id1,id2
// Returns up to N native (post-like) ads for the social feed, filtered by the
// viewer's targeting attributes, excluding already-seen ad ids (rotation).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(Math.max(parseInt(searchParams.get("count") || "8"), 1), 20);
  const exclude = new Set(
    (searchParams.get("exclude") ?? "").split(",").filter(Boolean)
  );

  const session = await auth();

  // Ad-free plans see no in-feed ads.
  let viewer: TargetableUser = {};
  if (session?.user?.id) {
    const [pkg, u] = await Promise.all([
      getEffectivePackage(session.user.id),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          country: true,
          city: true,
          gender: true,
          level: true,
          dateOfBirth: true,
          kycStatus: true,
          isBlueVerified: true,
          tags: true,
          language: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
    ]);
    if (pkg?.adFree) return NextResponse.json({ ads: [] });
    viewer = { ...(u ?? {}), packageSlug: pkg?.slug ?? null };
  }

  const placement = await prisma.adPlacement.findFirst({
    where: { name: "IN_FEED", isActive: true },
    select: { id: true },
  });
  if (!placement) return NextResponse.json({ ads: [] });

  const cost = await getAdClickCost();
  const ads = await prisma.ad.findMany({
    where: {
      placementId: placement.id,
      status: "ACTIVE",
      format: "NATIVE",
      campaign: { status: "ACTIVE", budget: { gte: cost } },
    },
    select: {
      id: true,
      weight: true,
      headline: true,
      brandName: true,
      brandLogo: true,
      ctaLabel: true,
      contentUrl: true,
      videoUrl: true,
      targetUrl: true,
      targeting: true,
      promotedPostId: true,
    },
  });

  // Targeting filter → drop already-seen (rotation) → weighted shuffle.
  const eligible = ads.filter((a) => matchesTargeting(a.targeting, viewer));
  const unseen = eligible.filter((a) => !exclude.has(a.id));
  // Prefer unseen; only fall back to the full pool once everything's been shown.
  const pool = unseen.length > 0 ? unseen : eligible;
  const shuffled = weightedShuffle(pool);
  const picked = shuffled.slice(0, count);

  // Resolve promoted posts (author + content) in one batch.
  const postIds = picked.map((a) => a.promotedPostId).filter((x): x is string => !!x);
  const posts = postIds.length
    ? await prisma.post.findMany({
        where: { id: { in: postIds } },
        select: {
          id: true,
          content: true,
          images: true,
          backgroundStyle: true,
          user: {
            select: {
              name: true,
              username: true,
              avatar: true,
              isBlueVerified: true,
              verifiedBadgeStyle: true,
            },
          },
        },
      })
    : [];
  const postMap = new Map(posts.map((p) => [p.id, p]));

  const result = picked
    .map((a) => {
      if (a.promotedPostId) {
        const p = postMap.get(a.promotedPostId);
        if (!p) return null;
        return {
          adId: a.id,
          kind: "post" as const,
          author: {
            name: p.user?.name ?? p.user?.username ?? "User",
            username: p.user?.username ?? null,
            avatar: p.user?.avatar ?? null,
            isBlueVerified: p.user?.isBlueVerified ?? false,
            verifiedBadgeStyle: p.user?.verifiedBadgeStyle ?? null,
          },
          content: p.content ?? "",
          images: p.images ?? [],
          videoUrl: null,
          backgroundStyle: p.backgroundStyle ?? null,
          ctaLabel: a.ctaLabel || "Learn More",
          targetUrl: a.targetUrl ?? null,
        };
      }
      // Custom brand creative
      return {
        adId: a.id,
        kind: "brand" as const,
        author: {
          name: a.brandName || "Sponsored",
          username: null,
          avatar: a.brandLogo ?? null,
          isBlueVerified: false,
          verifiedBadgeStyle: null,
        },
        content: a.headline ?? "",
        images: a.contentUrl ? [a.contentUrl] : [],
        videoUrl: a.videoUrl ?? null,
        backgroundStyle: null,
        ctaLabel: a.ctaLabel || "Learn More",
        targetUrl: a.targetUrl ?? null,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ ads: result });
}

/** Order items by a weighted-random draw (higher weight → earlier, on average). */
function weightedShuffle<T extends { weight: number | null }>(items: T[]): T[] {
  return [...items]
    .map((item) => ({
      item,
      key: Math.pow(Math.random(), 1 / Math.max(item.weight ?? 10, 1)),
    }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.item);
}
