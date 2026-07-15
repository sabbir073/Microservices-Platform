import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { ensureDefaultPlacements } from "@/lib/ad-placements-server";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Make sure the canonical slots always exist.
  await ensureDefaultPlacements().catch(() => {});
  const [placements, ads] = await Promise.all([
    prisma.adPlacement.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { ads: true } } },
    }),
    prisma.ad.findMany({
      select: { placementId: true, status: true, impressions: true, clicks: true },
    }),
  ]);

  // Aggregate live stats per placement from the Ad table.
  const statsByPlacement = new Map<
    string,
    { impressions: number; clicks: number; activeAds: number; totalAds: number }
  >();
  for (const ad of ads) {
    const cur =
      statsByPlacement.get(ad.placementId) ?? {
        impressions: 0,
        clicks: 0,
        activeAds: 0,
        totalAds: 0,
      };
    cur.impressions += ad.impressions;
    cur.clicks += ad.clicks;
    cur.totalAds += 1;
    if (ad.status === "ACTIVE") cur.activeAds += 1;
    statsByPlacement.set(ad.placementId, cur);
  }

  const withStats = placements.map((p) => ({
    ...p,
    stats:
      statsByPlacement.get(p.id) ?? {
        impressions: 0,
        clicks: 0,
        activeAds: 0,
        totalAds: 0,
      },
  }));

  return NextResponse.json({ placements: withStats });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const placement = await prisma.adPlacement.upsert({
    where: { name },
    create: { name, platform: body.platform || "ALL", isActive: true },
    update: {},
  });
  return NextResponse.json({ placement });
}
