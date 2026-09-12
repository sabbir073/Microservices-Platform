import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";
import { runLeaderboardReset } from "@/lib/leaderboard-reset";

const schema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]),
});

/**
 * Publish a leaderboard cycle NOW, from the admin screen.
 *
 * All of the selection, distribution and payout logic moved to
 * `lib/leaderboard-reset` so the Vercel cron runs the exact same code. This
 * route is now only auth + validation + shaping the response; if you are
 * looking for the idempotency rule, it is documented at the top of that file.
 *
 * The manual button pays the CURRENT window (`at` defaults to now), which is
 * what "reset it right now" means. The scheduler pays the window that just
 * closed. They meet on the same `cycleId`, so pressing this button mid-month
 * and then letting the cron close that month pays exactly once.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, "leaderboards.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const v = schema.safeParse(body);
  if (!v.success) {
    return NextResponse.json(
      { error: "Invalid input", details: v.error.issues },
      { status: 400 }
    );
  }

  const out = await runLeaderboardReset({
    period: v.data.period,
    actorUserId: session.user.id,
    source: "manual",
  });

  if (!out.ok) {
    return NextResponse.json(
      { error: out.error ?? "Reset failed", cycleId: out.cycleId },
      { status: out.status ?? 400 }
    );
  }

  // A run that paid nobody because everybody was already paid is not a success
  // to report as one — it is the double-run guard doing its job.
  if (out.paid === 0 && out.skipped > 0) {
    return NextResponse.json(
      {
        error: `The ${out.period} leaderboard for this period was already published and paid out. Nothing was paid twice.`,
        cycleId: out.cycleId,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    cycleId: out.cycleId,
    period: out.period,
    awarded: out.paid,
    skipped: out.skipped,
    totalDistributed: out.totalDistributed,
    totalXp: out.totalXp,
    giftsAwarded: out.giftsAwarded,
  });
}
