import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const AD_TYPES = ["LOCAL", "HTML", "SDK", "META"];
const AD_STATUSES = ["ACTIVE", "INACTIVE", "PAUSED"];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.campaignId) data.campaignId = String(body.campaignId);
  if (body.placementId) data.placementId = String(body.placementId);
  if (body.type && AD_TYPES.includes(body.type)) data.type = body.type;
  if (body.format !== undefined) data.format = String(body.format || "BANNER");
  if (body.contentUrl !== undefined) data.contentUrl = body.contentUrl ? String(body.contentUrl) : null;
  if (body.targetUrl !== undefined) data.targetUrl = body.targetUrl ? String(body.targetUrl) : null;
  if (body.htmlContent !== undefined) data.htmlContent = body.htmlContent ? String(body.htmlContent) : null;
  if (body.weight !== undefined) data.weight = Math.max(1, Number(body.weight) || 10);
  if (body.status && AD_STATUSES.includes(body.status)) data.status = body.status;
  if (body.rewardPoints !== undefined) data.rewardPoints = Math.max(0, Number(body.rewardPoints) || 0);
  if (body.rewardCooldownSec !== undefined)
    data.rewardCooldownSec = Math.max(0, Number(body.rewardCooldownSec) || 3600);
  if (body.watchSeconds !== undefined) data.watchSeconds = Math.max(1, Number(body.watchSeconds) || 15);

  const ad = await prisma.ad.update({ where: { id }, data });
  return NextResponse.json({ ad });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.ad.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
