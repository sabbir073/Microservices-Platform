import { prisma } from "@/lib/prisma";
import { UNKNOWN_COUNTRY } from "@/lib/ad-geo";

/** Midnight-UTC bucket for today (matches AdDailyStat.date @db.Date). */
export function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Increment today's rollup row for an ad. Best-effort — never throws (analytics
 * must not break serving/billing). Used by the impression beacon and click bill.
 */
export async function bumpAdDailyStat(
  adId: string,
  delta: { impressions?: number; clicks?: number; spendUsd?: number },
  /**
   * Country to attribute this delta to, from `resolveEventCountry`. Defaults to
   * the explicit unknown bucket rather than skipping the country row: a caller
   * that forgets to resolve one must still show up in the breakdown's "Unknown"
   * share, because the alternative is a total that silently disagrees with
   * `AdDailyStat` beside it.
   */
  country: string = UNKNOWN_COUNTRY
): Promise<void> {
  const date = todayUtc();
  const inc = {
    impressions: delta.impressions ?? 0,
    clicks: delta.clicks ?? 0,
    spendUsd: delta.spendUsd ?? 0,
  };
  try {
    // Two upserts, not a $transaction: these are analytics rollups on two
    // different rows, both driven by `increment`, so a partial write loses a
    // count rather than corrupting one — and Accelerate rejects a transaction
    // over 15s (P6005), which is a far worse failure to put in front of the
    // click-billing path that calls this.
    await prisma.adDailyStat.upsert({
      where: { adId_date: { adId, date } },
      create: { adId, date, ...inc },
      update: {
        impressions: { increment: inc.impressions },
        clicks: { increment: inc.clicks },
        spendUsd: { increment: inc.spendUsd },
      },
    });
  } catch {
    /* ignore — rollup is non-critical */
  }
  await bumpAdCountryDailyStat(adId, country, inc);
}

/**
 * Increment today's per-country rollup for an ad. Best-effort, same contract as
 * `bumpAdDailyStat` — an analytics dimension must never break a click bill.
 *
 * Kept beside `bumpAdDailyStat` on purpose: the two tables have to move
 * together or the country breakdown will not add up to the panel next to it.
 */
export async function bumpAdCountryDailyStat(
  adId: string,
  country: string,
  delta: { impressions?: number; clicks?: number; spendUsd?: number }
): Promise<void> {
  const date = todayUtc();
  const inc = {
    impressions: delta.impressions ?? 0,
    clicks: delta.clicks ?? 0,
    spendUsd: delta.spendUsd ?? 0,
  };
  if (!inc.impressions && !inc.clicks && !inc.spendUsd) return;
  try {
    await prisma.adCountryDailyStat.upsert({
      where: {
        adId_country_date: { adId, country: country || UNKNOWN_COUNTRY, date },
      },
      create: { adId, country: country || UNKNOWN_COUNTRY, date, ...inc },
      update: {
        impressions: { increment: inc.impressions },
        clicks: { increment: inc.clicks },
        spendUsd: { increment: inc.spendUsd },
      },
    });
  } catch {
    /* ignore — rollup is non-critical */
  }
}

/**
 * Lifetime impressions per ad, from `AdDailyStat` — the CANONICAL counter.
 *
 * ## Why there are two counters at all, and which one wins
 *
 * Every impression increments two things in the same transaction: `Ad.impressions`
 * (a lifetime running total on the ad row) and `AdDailyStat.impressions` (the
 * date-partitioned rollup). They were not always written together, and the
 * database still carries the scar: 72 impressions of disagreement across 5 ads,
 * in BOTH directions, all of it pre-dating the buffered counter. Clicks agree
 * exactly, which is the tell — clicks were never buffered, because they are money.
 *
 * `AdDailyStat` is canonical, for reasons that are not a coin toss:
 *
 *  - It is the only one with a time axis. Every report, chart and date range is
 *    already built on it, including the per-country rollup, which is derived by
 *    summing the same flushed batch and therefore agrees with it by construction.
 *  - A lifetime total can be rebuilt from dailies; dailies can never be rebuilt
 *    from a lifetime total. The reconstructable number is not the source.
 *  - It is what the admin sees. Two surfaces quoting different impression counts
 *    for the same ad is worse than either number being slightly off: it destroys
 *    trust in both, and the advertiser dashboard is a number the owner is BILLING
 *    against.
 *
 * `Ad.impressions` keeps being written — it is a cheap denormalised total and the
 * serve path already has the row — but nothing user-facing reads it any more, so
 * the historic drift is now inert rather than contradictory. It is deliberately
 * NOT back-corrected: rewriting a ledger-adjacent counter to make a number prettier
 * is how history stops being history, and the daily rows are already right.
 */
export async function lifetimeImpressionsByAd(
  adIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (adIds.length === 0) return out;
  // Accelerate collapses wide groupBy typings to `{}` — restate the row shape.
  const rows = (await prisma.adDailyStat.groupBy({
    by: ["adId"],
    where: { adId: { in: adIds } },
    _sum: { impressions: true },
  })) as unknown as { adId: string; _sum: { impressions: number | null } }[];
  for (const r of rows) out.set(r.adId, r._sum.impressions ?? 0);
  return out;
}
