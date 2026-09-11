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
