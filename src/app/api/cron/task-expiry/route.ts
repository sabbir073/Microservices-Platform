import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron";

// GET|POST /api/cron/task-expiry
// Flips ACTIVE tasks whose `expiresAt` has passed to EXPIRED so they drop out
// of the earn feeds. Idempotent — only touches still-ACTIVE past-deadline rows.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();
    const { count } = await prisma.task.updateMany({
      where: { status: "ACTIVE", expiresAt: { not: null, lte: now } },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ expired: count });
  } catch (error) {
    console.error("Task expiry cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;
