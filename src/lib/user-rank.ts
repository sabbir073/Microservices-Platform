/**
 * Compute a user's rank on the XP leaderboard.
 *
 * Rank = 1 + count of users whose xp is strictly greater than this user's xp.
 * Ties are broken implicitly (a tied user is ranked the same as everyone else
 * with their xp, since none have strictly greater xp).
 *
 * Cached for 60 seconds per (userId, xpBucket) — leaderboard positions move
 * slowly enough that a one-minute staleness is invisible to the user.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

async function rawComputeRank(xp: number): Promise<number> {
  const ahead = await prisma.user.count({
    where: { xp: { gt: xp }, status: "ACTIVE" },
  });
  return ahead + 1;
}

/**
 * Returns the user's rank on the XP leaderboard.
 *
 * Pass `xp` so the cache key reflects the current xp bucket. When the user's
 * xp changes, a fresh cache entry is created automatically; the previous one
 * just expires harmlessly within 60s.
 */
export async function getXpRank(userId: string, xp: number): Promise<number> {
  // Bucket xp to keep cache hit rate sane while still being responsive.
  // 50-XP buckets at low ranks, doubling up at higher xp.
  const bucket = Math.floor(xp / 50);
  const cached = unstable_cache(
    () => rawComputeRank(xp),
    ["user-xp-rank", userId, String(bucket)],
    { revalidate: 60 }
  );
  return cached();
}

/** Total XP needed to be AT a given level (cumulative from 0). */
export function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 100;
  if (level === 3) return 250;
  if (level === 4) return 500;
  if (level === 5) return 1000;
  if (level === 6) return 2000;
  if (level === 7) return 4000;
  if (level === 8) return 7000;
  if (level === 9) return 11000;
  if (level === 10) return 16000;
  if (level === 11) return 22000;
  return 22000 + (level - 11) * 10000;
}

/** Convenience: returns progress + needed + percentage for the user's current level. */
export function levelProgress(level: number, xp: number): {
  xpProgress: number;
  xpNeeded: number;
  xpPercentage: number;
} {
  const xpForCurrent = calculateXpForLevel(level);
  const xpForNext = calculateXpForLevel(level + 1);
  const xpProgress = xp - xpForCurrent;
  const xpNeeded = Math.max(1, xpForNext - xpForCurrent);
  const xpPercentage = Math.max(
    0,
    Math.min(100, Math.round((xpProgress / xpNeeded) * 100))
  );
  return { xpProgress, xpNeeded, xpPercentage };
}
