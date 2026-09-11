import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * Who is owed which leaderboard gift, and marking one handed over.
 *
 * `lb_gift_items` promises a phone or a tour package to rank 1. This is the
 * ledger of those promises: the payout writes a PENDING row per winning rank,
 * the winner gets a notification naming the gift, and an admin closes the loop
 * here. No addresses, no couriers — deliberately not a shipping system.
 */
const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING", "FULFILLED", "CANCELLED"]),
  notes: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, "leaderboards.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const rowsRaw = await prisma.leaderboardGiftAward.findMany({
    where:
      status === "PENDING" || status === "FULFILLED" || status === "CANCELLED"
        ? { status }
        : undefined,
    orderBy: [{ createdAt: "desc" }, { rank: "asc" }],
    take: 200,
    select: {
      id: true,
      cycleId: true,
      period: true,
      rank: true,
      giftName: true,
      giftImage: true,
      status: true,
      notes: true,
      fulfilledAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  // Accelerate collapses wide selects to `{}` — restate the row shape.
  const rows = rowsRaw as unknown as Array<{
    id: string;
    cycleId: string;
    period: string;
    rank: number;
    giftName: string;
    giftImage: string | null;
    status: string;
    notes: string | null;
    fulfilledAt: Date | null;
    createdAt: Date;
    user: { id: string; name: string | null; email: string } | null;
  }>;

  return NextResponse.json({
    gifts: rows.map((g) => ({
      id: g.id,
      cycleId: g.cycleId,
      period: g.period,
      rank: g.rank,
      giftName: g.giftName,
      giftImage: g.giftImage,
      status: g.status,
      notes: g.notes,
      fulfilledAt: g.fulfilledAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
      userId: g.user?.id ?? null,
      userName: g.user?.name ?? "Anonymous",
      userEmail: g.user?.email ?? "",
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, "leaderboards.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const v = patchSchema.safeParse(await request.json());
  if (!v.success) {
    return NextResponse.json(
      { error: "Invalid input", details: v.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.leaderboardGiftAward.findUnique({
    where: { id: v.data.id },
    select: { id: true, status: true, userId: true, giftName: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.leaderboardGiftAward.update({
    where: { id: v.data.id },
    data: {
      status: v.data.status,
      notes: v.data.notes ?? undefined,
      fulfilledAt: v.data.status === "FULFILLED" ? new Date() : null,
      fulfilledById: v.data.status === "FULFILLED" ? session.user.id : null,
    },
    select: { id: true, status: true },
  });

  // `targetUserId` names the account this landed on, so the action shows up on
  // that user's activity view and not only in the admin log.
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LEADERBOARD_GIFT_STATUS",
      entity: "LeaderboardGiftAward",
      entityId: v.data.id,
      targetUserId: existing.userId,
      summary: `Gift "${existing.giftName}" → ${v.data.status}`,
      oldData: { status: existing.status },
      newData: { status: v.data.status, notes: v.data.notes ?? null },
    },
  });

  return NextResponse.json({ success: true, gift: updated });
}
