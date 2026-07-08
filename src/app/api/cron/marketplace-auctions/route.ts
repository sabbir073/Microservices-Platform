import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { closeDueAuctions } from "@/lib/marketplace-auctions";

// GET|POST /api/cron/marketplace-auctions
// Settles auction-mode listings whose end time has passed (winner picked if the
// reserve is met, otherwise EXPIRED). Shares `closeDueAuctions` with the admin
// manual trigger. `hasMore: true` means call again to drain the backlog.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await closeDueAuctions();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Marketplace auctions cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;
