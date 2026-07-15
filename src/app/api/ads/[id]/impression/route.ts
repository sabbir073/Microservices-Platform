import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bumpAdDailyStat } from "@/lib/ad-stats";

/**
 * Records an ad impression (fire-and-forget). Called by FeedAdCard once the ad
 * scrolls into view. Increments the lifetime counter + today's rollup. The
 * client dedupes per slot so we don't double-count a single render.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.ad
    .update({ where: { id }, data: { impressions: { increment: 1 } } })
    .catch(() => null);
  await bumpAdDailyStat(id, { impressions: 1 });

  return NextResponse.json({ success: true });
}
