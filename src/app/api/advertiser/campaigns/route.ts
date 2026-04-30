import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await prisma.adCampaign.findMany({
    where: { advertiserId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate metrics from associated ads
  const campaignIds = campaigns.map((c) => c.id);
  const ads = await prisma.ad.findMany({
    where: { campaignId: { in: campaignIds } },
    select: {
      campaignId: true,
      impressions: true,
      clicks: true,
    },
  });

  const metricsByCampaign = new Map<
    string,
    { impressions: number; clicks: number }
  >();
  for (const ad of ads) {
    const cur = metricsByCampaign.get(ad.campaignId) ?? {
      impressions: 0,
      clicks: 0,
    };
    cur.impressions += ad.impressions;
    cur.clicks += ad.clicks;
    metricsByCampaign.set(ad.campaignId, cur);
  }

  const totalImpressions = Array.from(metricsByCampaign.values()).reduce(
    (sum, m) => sum + m.impressions,
    0
  );
  const totalClicks = Array.from(metricsByCampaign.values()).reduce(
    (sum, m) => sum + m.clicks,
    0
  );

  const enriched = campaigns.map((c) => {
    const m = metricsByCampaign.get(c.id) ?? { impressions: 0, clicks: 0 };
    const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
    // Spent ≈ budget * (clicks / max(1, totalCampaignClicks)) — simplified estimate
    const spent = Math.min(
      c.budget,
      m.clicks * 0.05 // $0.05 per click estimate
    );
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status as "ACTIVE" | "PAUSED" | "ENDED" | "DRAFT",
      budget: c.budget,
      spent,
      impressions: m.impressions,
      clicks: m.clicks,
      ctr,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return NextResponse.json({
    campaigns: enriched,
    stats: {
      campaigns: campaigns.length,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr:
        totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    },
  });
}

const createSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().optional(),
  budget: z.number().min(5),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const v = createSchema.safeParse(body);
  if (!v.success) {
    return NextResponse.json(
      { error: v.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const campaign = await prisma.adCampaign.create({
    data: {
      title: v.data.title,
      description: v.data.description ?? null,
      budget: v.data.budget,
      advertiserId: session.user.id,
      status: "ACTIVE",
    },
  });

  return NextResponse.json(
    {
      success: true,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        budget: campaign.budget,
        spent: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        createdAt: campaign.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
