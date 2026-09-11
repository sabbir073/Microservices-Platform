import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSetting, invalidateSettingsCache } from "@/lib/system-settings";
import { prisma } from "@/lib/prisma";
import {
  cycleKey,
  lastClosedWindowAnchor,
  runLeaderboardReset,
  type Period,
  type ResetOutcome,
} from "@/lib/leaderboard-reset";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Close finished leaderboard cycles and pay the winners, on a schedule.
 *
 * This is what `lb_auto_reset` turns on. The switch has been ON in the live
 * database with a five-rank XP prize list configured behind it, and until this
 * route existed nothing ran: the owner had promised users daily, weekly and
 * monthly prizes that no code anywhere paid out.
 *
 * ── Timezone: UTC, everywhere ──
 * Vercel cron fires on UTC and `cycleKey` buckets on UTC, so a day is
 * 00:00Z–00:00Z, a week is Monday 00:00Z, and a month is the 1st at 00:00Z.
 * That is 06:00 in Asia/Dhaka, which is the honest trade: one fixed instant
 * worldwide beats a local midnight that drifts with DST and could bucket the
 * same window under two different ids — which is how you pay twice.
 *
 * ── Missed windows ──
 * It runs HOURLY, not once at midnight, and it does not ask "when did I last
 * run". Each tick computes the most recently CLOSED window from the calendar
 * (`lastClosedWindowAnchor`) and tries to pay it. So:
 *   - a deploy or outage across midnight delays the payout to the next hour and
 *     never skips it;
 *   - the 23 catch-up ticks that follow a successful payout are no-ops, because
 *     the cycle is sealed `completed` and short-circuits before any ranking
 *     query runs;
 *   - and if it did somehow reach the payout, the ledger's
 *     `@@unique([userId, reference])` would reject the second credit anyway.
 *
 * Authorised exactly like `/api/cron/recheck-submissions`: `CRON_SECRET` as a
 * bearer token or `?key=`, or a signed-in admin with `leaderboards.manage`.
 * With no `CRON_SECRET` set the scheduled route is refused rather than left
 * open — this endpoint moves real money.
 */
async function authorise(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const bearer = req.headers.get("authorization");
    const key = req.nextUrl.searchParams.get("key");
    if (bearer === `Bearer ${secret}` || key === secret) return true;
  }
  const session = await auth();
  if (session?.user?.id && (await can(session.user.id, "leaderboards.manage"))) {
    return true;
  }
  return false;
}

const PERIODS: Period[] = ["daily", "weekly", "monthly"];

function autoResetOn(v: unknown): boolean {
  const unwrapped =
    v && typeof v === "object" && "v" in (v as object)
      ? (v as { v: unknown }).v
      : v;
  if (typeof unwrapped === "boolean") return unwrapped;
  if (unwrapped === "true") return true;
  // Absent means never configured — do not start paying prizes on a default.
  return false;
}

async function run(req: NextRequest) {
  if (!(await authorise(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!autoResetOn(await getSetting<unknown>("lb_auto_reset", null))) {
    return NextResponse.json({
      ok: true,
      skipped: "lb_auto_reset is off",
      ran: [],
    });
  }

  const now = new Date();

  // ── Nothing is paid for a window that closed before this existed ──
  //
  // `lb_auto_reset` has been TRUE in the live database since long before any
  // scheduler read it. Each tick settles the most recently closed window, so
  // without this the very first tick after deploy would pay out yesterday's
  // daily cycle, last week's and last month's — real points and real XP, for
  // periods during which nobody was competing under these rules and the owner
  // never chose to pay.
  //
  // So the first tick records the moment the scheduler came alive and seals
  // those windows unpaid. Every later tick runs normally. Written with `create`,
  // not upsert: if two cold-start invocations race, exactly one claims the
  // moment and the loser is a no-op rather than moving the line forward.
  const FIRST_RUN_KEY = "lb_auto_reset_live_since";
  const liveSince = await getSetting<string | null>(FIRST_RUN_KEY, null);
  if (!liveSince) {
    const sealed: string[] = [];
    for (const period of PERIODS) {
      const anchor = lastClosedWindowAnchor(period, now);
      const cycleId = `${cycleKey(period, anchor)}_${period}`;
      try {
        await prisma.systemSetting.create({
          data: {
            key: `lb_history_${cycleId}`,
            category: "leaderboard",
            value: {
              cycleId,
              period,
              completed: true,
              sealedWithoutPayout: true,
              reason:
                "Closed before automatic resets went live — not paid, on purpose.",
              sealedAt: now.toISOString(),
              winners: [],
            },
          },
        });
        sealed.push(cycleId);
      } catch {
        // Already claimed by a real payout or a racing cold start. Either way
        // this window is somebody else's to settle; leave it alone.
      }
    }
    await prisma.systemSetting.upsert({
      where: { key: FIRST_RUN_KEY },
      create: {
        key: FIRST_RUN_KEY,
        category: "leaderboard",
        value: now.toISOString(),
      },
      update: {},
    });
    invalidateSettingsCache();
    return NextResponse.json({
      ok: true,
      firstRun: true,
      sealedWithoutPayout: sealed,
      note: "Windows that closed before automatic resets went live are sealed unpaid. The next window pays normally.",
    });
  }

  const only = req.nextUrl.searchParams.get("period");
  const periods = only
    ? PERIODS.filter((p) => p === only)
    : PERIODS;

  const ran: Array<{
    period: Period;
    cycleId: string;
    status: string;
    paid?: number;
    skipped?: number;
    points?: number;
    xp?: number;
    gifts?: number;
    error?: string;
  }> = [];

  for (const period of periods) {
    const anchor = lastClosedWindowAnchor(period, now);
    const cycleId = `${cycleKey(period, anchor)}_${period}`;
    let out: ResetOutcome;
    try {
      out = await runLeaderboardReset({
        period,
        at: anchor,
        actorUserId: null,
        source: "cron",
      });
    } catch (err) {
      // One period failing must not stop the other two from being paid.
      ran.push({
        period,
        cycleId,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    if (out.alreadyCompleted) {
      ran.push({ period, cycleId: out.cycleId, status: "already-settled" });
    } else if (!out.ok) {
      ran.push({
        period,
        cycleId: out.cycleId,
        status: "not-eligible",
        error: out.error,
      });
    } else {
      ran.push({
        period,
        cycleId: out.cycleId,
        status: out.paid > 0 ? "paid" : "nothing-to-pay",
        paid: out.paid,
        skipped: out.skipped,
        points: out.totalDistributed,
        xp: out.totalXp,
        gifts: out.giftsAwarded,
      });
    }
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), ran });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
