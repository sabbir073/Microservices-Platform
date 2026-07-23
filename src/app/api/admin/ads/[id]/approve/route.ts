import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { notifyUser } from "@/lib/notify";
import { NotificationType } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/ads/[id]/approve — approve a PENDING (advertiser-submitted) ad
// so it starts serving, and notify the advertiser.
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const ad = await prisma.ad.findUnique({
    where: { id },
    include: { campaign: { select: { title: true, advertiserId: true } } },
  });
  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  const updated = await prisma.ad.update({
    where: { id },
    data: {
      status: "ACTIVE",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      rejectionReason: null,
    },
  });

  const advertiserId = ad.submittedById ?? ad.campaign.advertiserId;
  if (advertiserId) {
    await notifyUser({
      userId: advertiserId,
      type: NotificationType.SYSTEM,
      title: "Ad approved ✅",
      message: `Your ad in "${ad.campaign.title}" is approved and now live.`,
      link: "/advertiser",
    }).catch(() => {});
  }

  return NextResponse.json({ ad: updated });
}
