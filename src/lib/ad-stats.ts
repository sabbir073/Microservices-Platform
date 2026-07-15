import { prisma } from "@/lib/prisma";

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
  delta: { impressions?: number; clicks?: number; spendUsd?: number }
): Promise<void> {
  const date = todayUtc();
  const inc = {
    impressions: delta.impressions ?? 0,
    clicks: delta.clicks ?? 0,
    spendUsd: delta.spendUsd ?? 0,
  };
  try {
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
}
