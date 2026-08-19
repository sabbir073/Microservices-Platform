import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { AdReviewError, rejectAd } from "@/lib/ad-review";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  reasonCodes: z.array(z.string()).default([]),
  message: z.string().max(2000).optional().nullable(),
  internalNote: z.string().max(2000).optional().nullable(),
});

// POST /api/admin/ads/[id]/reject — reject an ad (won't serve) with a reason the
// advertiser can actually read and act on. A reason is REQUIRED: the old route
// silently substituted "Not approved.", which told the advertiser nothing.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user || !(await can(session.user.id, "ads.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const ad = await rejectAd({
      adId: id,
      actorId: session.user.id,
      reasonCodes: parsed.data.reasonCodes,
      message: parsed.data.message ?? null,
      internalNote: parsed.data.internalNote ?? null,
    });
    return NextResponse.json({ ad });
  } catch (e) {
    if (e instanceof AdReviewError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    throw e;
  }
}
