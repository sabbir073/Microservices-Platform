import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron";
import { drawLottery } from "@/lib/lottery";

// GET|POST /api/cron/lottery-draw
// Auto-draws every ACTIVE lottery whose drawDate has passed. Empty lotteries
// (no tickets sold) are skipped and left ACTIVE for an admin to cancel/extend.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();
    const due = await prisma.lottery.findMany({
      where: { status: "ACTIVE", drawDate: { lte: now } },
      select: { id: true },
      take: 25,
    });

    let drawn = 0;
    let skipped = 0;
    for (const { id } of due) {
      const result = await drawLottery(id);
      if (result.ok) drawn++;
      else skipped++;
    }

    return NextResponse.json({ candidates: due.length, drawn, skipped });
  } catch (error) {
    console.error("Lottery draw cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;
