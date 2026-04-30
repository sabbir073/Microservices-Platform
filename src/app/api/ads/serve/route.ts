import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placement = searchParams.get("placement");

  if (!placement) {
    return NextResponse.json({ error: "placement required" }, { status: 400 });
  }

  // Find placement by name
  const placementRow = await prisma.adPlacement.findFirst({
    where: { name: placement, isActive: true },
  });
  if (!placementRow) {
    return NextResponse.json({ ad: null });
  }

  // Get active ads for this placement, weighted random selection
  const ads = await prisma.ad.findMany({
    where: {
      placementId: placementRow.id,
      status: "ACTIVE",
      campaign: { status: "ACTIVE" },
    },
    include: { campaign: { select: { title: true } } },
  });

  if (ads.length === 0) {
    return NextResponse.json({ ad: null });
  }

  // Weighted pick
  const totalWeight = ads.reduce((sum, a) => sum + (a.weight ?? 10), 0);
  let pick = Math.random() * totalWeight;
  let chosen = ads[0];
  for (const ad of ads) {
    pick -= ad.weight ?? 10;
    if (pick <= 0) {
      chosen = ad;
      break;
    }
  }

  // Increment impression counter (fire-and-forget)
  prisma.ad
    .update({
      where: { id: chosen.id },
      data: { impressions: { increment: 1 } },
    })
    .catch(() => {});

  return NextResponse.json({
    ad: {
      id: chosen.id,
      type: chosen.type,
      imageUrl: chosen.contentUrl ?? undefined,
      title: chosen.campaign.title,
      body: undefined,
      ctaLabel: "Learn More",
      ctaUrl: chosen.targetUrl ?? undefined,
      html: chosen.htmlContent ?? undefined,
      sponsor: undefined,
    },
  });
}
