import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { normalizeTargeting, type AdTargeting } from "@/lib/ad-targeting";

const AD_TYPES = ["LOCAL", "HTML", "SDK", "META"];
const AD_STATUSES = ["ACTIVE", "INACTIVE", "PAUSED"];

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ads = await prisma.ad.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      campaign: { select: { id: true, title: true } },
      placement: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ ads });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!body.campaignId || !body.placementId) {
    return NextResponse.json(
      { error: "Campaign and placement are required" },
      { status: 400 }
    );
  }
  const ad = await prisma.ad.create({
    data: {
      campaignId: String(body.campaignId),
      placementId: String(body.placementId),
      type: AD_TYPES.includes(body.type) ? body.type : "LOCAL",
      format: body.format ? String(body.format) : "BANNER",
      contentUrl: body.contentUrl ? String(body.contentUrl) : null,
      targetUrl: body.targetUrl ? String(body.targetUrl) : null,
      htmlContent: body.htmlContent ? String(body.htmlContent) : null,
      weight: Number.isFinite(Number(body.weight)) ? Math.max(1, Number(body.weight)) : 10,
      status: AD_STATUSES.includes(body.status) ? body.status : "ACTIVE",
      // Native (post-like) creative
      headline: body.headline ? String(body.headline) : null,
      brandName: body.brandName ? String(body.brandName) : null,
      brandLogo: body.brandLogo ? String(body.brandLogo) : null,
      ctaLabel: body.ctaLabel ? String(body.ctaLabel) : null,
      promotedPostId: body.promotedPostId ? String(body.promotedPostId) : null,
      targeting:
        (normalizeTargeting((body.targeting ?? {}) as AdTargeting) as
          | Prisma.InputJsonValue
          | null) ?? Prisma.JsonNull,
      rewardPoints: Math.max(0, Number(body.rewardPoints) || 0),
      rewardCooldownSec: Math.max(0, Number(body.rewardCooldownSec) || 3600),
      watchSeconds: Math.max(1, Number(body.watchSeconds) || 15),
    },
  });
  return NextResponse.json({ ad });
}
