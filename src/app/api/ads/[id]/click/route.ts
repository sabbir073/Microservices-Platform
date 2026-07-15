import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdClickCost } from "@/lib/ad-billing";
import { bumpAdDailyStat } from "@/lib/ad-stats";

/**
 * Records an ad click and bills the owning campaign's budget. The conditional
 * decrement (`budget >= cost`) is the no-overspend guard: when the remaining
 * budget can't cover another click, nothing is deducted and the campaign is
 * paused so `serve` stops showing it. Counting the click is best-effort and
 * never blocks the redirect.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ad = await prisma.ad
    .update({
      where: { id },
      data: { clicks: { increment: 1 } },
      select: { campaignId: true },
    })
    .catch(() => null);

  if (ad?.campaignId) {
    const cost = await getAdClickCost();
    // Atomic, no-overspend: only decrements when the budget still covers a click.
    const billed = await prisma.adCampaign.updateMany({
      where: { id: ad.campaignId, status: "ACTIVE", budget: { gte: cost } },
      data: { budget: { decrement: cost } },
    });
    // Roll up click + actual spend (0 when the campaign couldn't be billed).
    await bumpAdDailyStat(id, {
      clicks: 1,
      spendUsd: billed.count > 0 ? cost : 0,
    });
    if (billed.count === 0) {
      // Out of budget — pause so it drops out of rotation.
      await prisma.adCampaign
        .updateMany({
          where: { id: ad.campaignId, status: "ACTIVE" },
          data: { status: "PAUSED" },
        })
        .catch(() => {});
    }
  } else {
    await bumpAdDailyStat(id, { clicks: 1 });
  }

  return NextResponse.json({ success: true });
}
