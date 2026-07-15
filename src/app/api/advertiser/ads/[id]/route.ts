import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTargeting } from "@/lib/ad-targeting";

/** Load an ad and confirm the session user owns its campaign. */
async function ownAd(adId: string, userId: string) {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    select: { id: true, campaign: { select: { advertiserId: true } } },
  });
  if (!ad || ad.campaign?.advertiserId !== userId) return null;
  return ad;
}

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  weight: z.number().int().min(1).max(100).optional(),
  brandName: z.string().max(60).optional().nullable(),
  brandLogo: z.string().optional().nullable(),
  headline: z.string().max(500).optional().nullable(),
  contentUrl: z.string().optional().nullable(),
  ctaLabel: z.string().max(30).optional().nullable(),
  targetUrl: z.string().url().optional().nullable(),
  targeting: z
    .object({
      countries: z.array(z.string()).optional(),
      genders: z.array(z.string()).optional(),
      minLevel: z.number().int().min(0).optional(),
      packages: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await ownAd(id, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.status !== undefined) data.status = d.status;
  if (d.weight !== undefined) data.weight = d.weight;
  if (d.brandName !== undefined) data.brandName = d.brandName || null;
  if (d.brandLogo !== undefined) data.brandLogo = d.brandLogo || null;
  if (d.headline !== undefined) data.headline = d.headline || null;
  if (d.contentUrl !== undefined) data.contentUrl = d.contentUrl || null;
  if (d.ctaLabel !== undefined) data.ctaLabel = d.ctaLabel || null;
  if (d.targetUrl !== undefined) data.targetUrl = d.targetUrl || null;
  if (d.targeting !== undefined) {
    data.targeting =
      (normalizeTargeting(d.targeting ?? {}) as
        | Prisma.InputJsonValue
        | null) ?? Prisma.JsonNull;
  }

  await prisma.ad.update({ where: { id }, data });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await ownAd(id, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.ad.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
