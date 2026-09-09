import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";

/**
 * Shared, cross-instance rate limiting.
 *
 * The in-memory limiter (`src/lib/rate-limit.ts`) keeps its counters in a
 * module-scope Map, which on Vercel means one counter per serverless instance —
 * and the platform adds instances under exactly the load an attacker generates.
 * That makes it unusable for anything that must actually be bounded.
 *
 * This version keeps the counter in Postgres, so every instance sees the same
 * number. It costs one upsert per attempt, which is why it is reserved for the
 * endpoints where being wrong costs money: withdrawals, deposits, purchases,
 * reward claims, task submissions.
 *
 * It is a *rate* guard, not a correctness guard. Correctness still comes from
 * `withIdempotency` and the `@@unique([userId, reference])` ledger constraints —
 * this exists so the database isn't what absorbs an attack.
 */

export interface DbLimitResult {
  ok: boolean;
  retryAfterSec: number;
  count: number;
}

/**
 * Count one hit against `bucket` and report whether it is over `limit` for the
 * current window.
 *
 * Fails OPEN. If the limiter's own query fails we allow the request: a database
 * blip must not lock every user out of withdrawing their money. The endpoints
 * behind this are already idempotent, so an unlimited window during an outage is
 * the lesser risk.
 */
export async function dbRateLimit(
  bucket: string,
  limit: number,
  windowMs: number
): Promise<DbLimitResult> {
  const now = Date.now();
  const windowId = BigInt(Math.floor(now / windowMs));
  const resetAtMs = (Math.floor(now / windowMs) + 1) * windowMs;

  try {
    // The unique index on (bucket, window) makes this atomic: concurrent
    // requests either create the row or increment the same one.
    const row = await prisma.rateLimitHit.upsert({
      where: { bucket_window: { bucket, window: windowId } },
      create: {
        bucket,
        window: windowId,
        count: 1,
        expiresAt: new Date(resetAtMs),
      },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    if (row.count > limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
        count: row.count,
      };
    }
    return { ok: true, retryAfterSec: 0, count: row.count };
  } catch {
    return { ok: true, retryAfterSec: 0, count: 0 };
  }
}

/**
 * A true minimum GAP between two events, as opposed to a per-window quota.
 *
 * `dbRateLimit` buckets by `floor(now / windowMs)`, which is the right shape for
 * "N per hour" but the wrong one for "not again for 60 seconds": the window
 * rolls over on the wall clock, so an event at 10:59:59 and another at 11:00:00
 * both pass a 60-second "gap" one second apart. Ad pacing was built on it, and
 * a user finishing a reward on either side of a minute boundary could be shown
 * two full-screen ads back to back — the exact thing the setting exists to
 * prevent, and the kind of density that gets an ad account reviewed.
 *
 * This stores the moment the gap re-opens and compares against it, so the
 * window slides with the last event instead of with the clock. `window` is
 * pinned to 0 because there is only ever one row per bucket.
 *
 * Fails OPEN for the same reason as `dbRateLimit`: a limiter outage must not
 * take a feature down with it.
 */
/** The single row per gap bucket. `BigInt(0)` — the tsconfig target predates
 *  BigInt literals, so `0n` will not compile here. */
const GAP_WINDOW = BigInt(0);

export async function dbMinGap(
  bucket: string,
  gapMs: number
): Promise<DbLimitResult> {
  if (gapMs <= 0) return { ok: true, retryAfterSec: 0, count: 0 };
  const now = new Date();
  const reopensAt = new Date(now.getTime() + gapMs);

  try {
    // CAS: take the slot only if the previous gap has already elapsed. Two
    // concurrent callers cannot both match, so only one is let through.
    const claimed = await prisma.rateLimitHit.updateMany({
      where: { bucket, window: GAP_WINDOW, expiresAt: { lte: now } },
      data: { expiresAt: reopensAt, count: { increment: 1 } },
    });
    if (claimed.count > 0) return { ok: true, retryAfterSec: 0, count: 0 };

    // Nothing matched: either there is no row yet, or the gap is still open.
    // Read before writing, so the COMMON case — a refusal — costs a select
    // rather than a unique-constraint violation. Letting the insert fail worked
    // but logged a `prisma:error` on every ordinary refusal, which buries real
    // errors in the noise of the feature working correctly.
    const row = await prisma.rateLimitHit.findUnique({
      where: { bucket_window: { bucket, window: GAP_WINDOW } },
      select: { expiresAt: true, count: true },
    });

    if (row) {
      const remainingMs = row.expiresAt.getTime() - now.getTime();
      // The row could have expired between the CAS and this read; if so the
      // next caller takes it. Refusing here costs at most one extra wait.
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)),
        count: row.count,
      };
    }

    try {
      await prisma.rateLimitHit.create({
        data: { bucket, window: GAP_WINDOW, count: 1, expiresAt: reopensAt },
      });
      return { ok: true, retryAfterSec: 0, count: 1 };
    } catch {
      // Lost the race to create it — someone else holds the gap.
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil(gapMs / 1000)),
        count: 0,
      };
    }
  } catch {
    return { ok: true, retryAfterSec: 0, count: 0 };
  }
}

/**
 * Guard for a money/claim route: returns a 429 when over the limit, else null.
 *
 * Limits per USER where we have one (an attacker can rotate IPs but not
 * accounts), falling back to IP for unauthenticated callers.
 *
 * ```ts
 * const limited = await enforceDbRateLimit(req, "withdraw", session.user.id, 5, 60_000);
 * if (limited) return limited;
 * ```
 */
export async function enforceDbRateLimit(
  req: NextRequest,
  scope: string,
  userId: string | null | undefined,
  limit: number,
  windowMs: number
): Promise<NextResponse | null> {
  const subject = userId ? `u:${userId}` : `ip:${clientIp(req)}`;
  const { ok, retryAfterSec } = await dbRateLimit(
    `${scope}:${subject}`,
    limit,
    windowMs
  );
  if (ok) return null;
  return NextResponse.json(
    { error: `Too many requests. Try again in ${retryAfterSec}s.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

/** Delete expired counters. Called from the retention cron. */
export async function pruneRateLimitHits(): Promise<number> {
  try {
    const res = await prisma.rateLimitHit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return res.count;
  } catch {
    return 0;
  }
}
