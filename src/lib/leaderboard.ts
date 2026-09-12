import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getSetting } from "@/lib/system-settings";
import { NON_STAFF_WHERE } from "@/lib/staff";

export type LeaderboardMetric =
  | "POINTS_EARNED"
  | "XP_EARNED"
  | "TASKS_COMPLETED"
  | "REFERRALS"
  | "COMBINED";

export interface CombinedRow {
  rank: number;
  userId: string;
  name: string | null;
  avatar: string | null;
  level: number;
  packageSlug: string;
  packageName: string | null;
  /** 0–100 unified score (avg percentile across 4 metrics). */
  score: number;
  /** Per-metric component values for display in the row. */
  components: {
    points: number;
    xp: number;
    tasks: number;
    team: number;
  };
  /** True only when this user's package is in the eligibility allowlist. */
  isEligible: boolean;
}

/**
 * THE EARNINGS BASIS FOR EVERY BOARD: money earned from TASKS.
 *
 * `User.totalEarnings` used to be it, and it is not a ranking metric — it is a
 * lifetime credit counter that a marketplace SALE also increments. The seller's
 * total goes up and the buyer's never goes down, so two accounts selling the
 * same item back and forth to each other climb the board together. It costs
 * them the platform fee per lap and nothing else, and the prize reset paid out
 * on the same number.
 *
 * `TaskSubmission.pointsEarned` is what an approved submission actually paid,
 * written by every approval path, already indexed by user. Summing it needs no
 * new column and no backfill: the rows are the work.
 *
 * Deliberately NOT the `Transaction` ledger. A paid submission has three
 * different reference shapes there, `amount`'s sign is not consistent across
 * write sites, and the ledger also carries daily rewards, quiz prizes and
 * leaderboard prizes themselves — ranking on prize money you already won is a
 * feedback loop.
 */
const PAID_SUBMISSION = {
  status: { in: ["APPROVED", "AUTO_APPROVED"] },
  pointsEarned: { gt: 0 },
} satisfies Prisma.TaskSubmissionWhereInput;

/**
 * Task-earned points for a specific set of users. Missing = 0, never absent.
 */
export async function taskEarningsFor(
  userIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  const rowsRaw = await prisma.taskSubmission.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, ...PAID_SUBMISSION },
    _sum: { pointsEarned: true },
  });
  // Accelerate collapses groupBy typings — restate the row shape.
  const rows = rowsRaw as unknown as Array<{
    userId: string;
    _sum: { pointsEarned: number | null };
  }>;
  for (const r of rows) out.set(r.userId, r._sum.pointsEarned ?? 0);
  return out;
}

/**
 * The top task earners, ranked by the sum itself rather than by a proxy column.
 *
 * The aggregate is ordered in the DATABASE, so this is the real top N and not
 * "the top N of whoever happened to lead on `totalEarnings`". Staff are removed
 * afterwards, which is why the pool is pulled wider than `take`.
 */
export async function topTaskEarners(
  take: number
): Promise<Array<{ userId: string; points: number }>> {
  const want = Math.max(1, Math.min(take, 500));
  const rowsRaw = await prisma.taskSubmission.groupBy({
    by: ["userId"],
    where: PAID_SUBMISSION,
    _sum: { pointsEarned: true },
    orderBy: { _sum: { pointsEarned: "desc" } },
    take: Math.min(want * 4 + 50, 2000),
  });
  const rows = rowsRaw as unknown as Array<{
    userId: string;
    _sum: { pointsEarned: number | null };
  }>;
  if (rows.length === 0) return [];

  // Staff never appear on a public board and never win a prize, and this list
  // feeds both, so they come out here — once, at the shared source.
  const ids = rows.map((r) => r.userId);
  const live = await prisma.user.findMany({
    where: { id: { in: ids }, ...NON_STAFF_WHERE },
    select: { id: true },
  });
  const ok = new Set(live.map((u) => u.id));
  return rows
    .filter((r) => ok.has(r.userId))
    .map((r) => ({ userId: r.userId, points: r._sum.pointsEarned ?? 0 }))
    .slice(0, want);
}

/** Default eligibility — any paid tier. Free users see their rank but
 *  can't claim prizes unless admin explicitly opts FREE in. */
export const DEFAULT_ELIGIBLE_PACKAGES = [
  "STARTER",
  "PRO",
  "ELITE",
  "VIP",
];

/** Read the admin-configured eligibility allowlist from SystemSetting.
 *  Returns the default if no override exists. */
export async function getEligiblePackages(): Promise<string[]> {
  // Read through the cached getSetting (was a raw findUnique per leaderboard req).
  const val = await getSetting<unknown>("lb_eligible_packages", null);
  if (Array.isArray(val)) {
    return (val as unknown[]).map((s) => String(s).toUpperCase());
  }
  return DEFAULT_ELIGIBLE_PACKAGES;
}

/** Compute the combined-score leaderboard. Mixes all 4 metrics into a single
 *  score by averaging each user's percentile across each metric, so wildly
 *  different scales (1M points vs 50 tasks) all weigh roughly equally. */
export async function computeCombinedTopUsers(options: {
  limit: number;
  eligiblePackages?: string[];
  /** When true, only eligible users are included (used during prize reset). */
  filterEligible?: boolean;
}): Promise<CombinedRow[]> {
  const limit = Math.max(1, Math.min(options.limit, 200));
  const eligiblePackages =
    options.eligiblePackages ?? (await getEligiblePackages());
  const eligibleSet = new Set(eligiblePackages.map((s) => s.toUpperCase()));

  // Pull a generous candidate pool. We pre-filter with totalEarnings DESC
  // (the most common headline metric) but rerank in JS using all 4 metrics.
  // 500 candidates × 4 metric values is a tiny working set.
  //
  // Staff are excluded here, at the single place the combined board is built,
  // so the public board, the "your rank" line and the prize reset in
  // `api/admin/leaderboard/reset` all draw from the same population. The reset
  // pays real balances to the top N — an admin left in this pool gets paid.
  const POOL = 500;
  const usersRaw = await prisma.user.findMany({
    where: NON_STAFF_WHERE,
    orderBy: { totalEarnings: "desc" },
    take: POOL,
    select: {
      id: true,
      name: true,
      avatar: true,
      level: true,
      totalEarnings: true,
      xp: true,
      package: { select: { slug: true, name: true } },
    },
  });

  type User = {
    id: string;
    name: string | null;
    avatar: string | null;
    level: number;
    totalEarnings: number;
    xp: number;
    package: { slug: string; name: string } | null;
  };
  const users = usersRaw as unknown as User[];
  if (users.length === 0) return [];

  const ids = users.map((u) => u.id);

  // Task-EARNED points for the pool. This is the `points` component of the
  // combined score — `totalEarnings` is only the prefilter that chose the pool,
  // because a marketplace round-trip inflates it and would otherwise buy rank.
  const earnedByUser = await taskEarningsFor(ids);

  // Tasks count and Referrals count (parallel)
  const [taskRowsRaw, referralRowsRaw] = await Promise.all([
    prisma.taskSubmission.groupBy({
      by: ["userId"],
      where: {
        userId: { in: ids },
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
      },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["referredById"],
      where: { referredById: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  // Prisma Accelerate's typing collapses groupBy results — cast to known shape.
  const taskRows = taskRowsRaw as unknown as Array<{
    userId: string;
    _count: { _all: number };
  }>;
  const referralRows = referralRowsRaw as unknown as Array<{
    referredById: string | null;
    _count: { _all: number };
  }>;

  const tasksByUser = new Map<string, number>();
  for (const r of taskRows) tasksByUser.set(r.userId, r._count._all);
  const teamByUser = new Map<string, number>();
  for (const r of referralRows) {
    if (r.referredById) teamByUser.set(r.referredById, r._count._all);
  }

  // Build per-user component row
  const rows = users.map((u) => ({
    user: u,
    // Points EARNED FROM TASKS, already in points — no rate conversion, and no
    // Decimal. `toNum(u.totalEarnings)` was here and is what made rank buyable.
    points: earnedByUser.get(u.id) ?? 0,
    xp: u.xp,
    tasks: tasksByUser.get(u.id) ?? 0,
    team: teamByUser.get(u.id) ?? 0,
  }));

  // Percentile rank per metric (higher value = higher percentile).
  // Ties share the same percentile.
  function percentile(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    return (v: number) => {
      if (sorted.length === 0) return 0;
      // Count of values <= v (handles ties by giving everyone their tier).
      let lo = 0,
        hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (sorted[mid] <= v) lo = mid + 1;
        else hi = mid;
      }
      return Math.round((lo / sorted.length) * 100);
    };
  }

  const pPoints = percentile(rows.map((r) => r.points));
  const pXp = percentile(rows.map((r) => r.xp));
  const pTasks = percentile(rows.map((r) => r.tasks));
  const pTeam = percentile(rows.map((r) => r.team));

  // Combined score = average of 4 percentiles. 0–100 range.
  const scored = rows.map((r) => ({
    ...r,
    score:
      (pPoints(r.points) + pXp(r.xp) + pTasks(r.tasks) + pTeam(r.team)) / 4,
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: more points wins
    return b.points - a.points;
  });

  const filtered = options.filterEligible
    ? scored.filter((r) =>
        r.user.package?.slug
          ? eligibleSet.has(r.user.package.slug.toUpperCase())
          : false
      )
    : scored;

  return filtered.slice(0, limit).map((r, idx) => ({
    rank: idx + 1,
    userId: r.user.id,
    name: r.user.name,
    avatar: r.user.avatar,
    level: r.user.level,
    packageSlug: r.user.package?.slug ?? "FREE",
    packageName: r.user.package?.name ?? null,
    score: Math.round(r.score * 10) / 10,
    components: {
      // Already points — this used to multiply a USD figure by a hardcoded 1000.
      points: Math.round(r.points),
      xp: r.xp,
      tasks: r.tasks,
      team: r.team,
    },
    isEligible: r.user.package?.slug
      ? eligibleSet.has(r.user.package.slug.toUpperCase())
      : false,
  }));
}

/**
 * Combined rank of one user (the "your rank" line).
 *
 * `pool` lets the caller pass an ALREADY-CACHED top list. Without it this
 * recomputes the entire 500-user pipeline — a 500-row scan plus two groupBy over
 * TaskSubmission — for every viewer who isn't already in the visible top N,
 * which is nearly everyone, on a board that auto-refreshes every 30s.
 */
export async function computeCombinedUserRank(
  userId: string,
  pool?: CombinedRow[]
): Promise<{
  rank: number;
  score: number;
  isEligible: boolean;
  packageSlug: string;
  components: CombinedRow["components"];
} | null> {
  // Re-using the same algorithm. We compute over the candidate pool — if
  // the user isn't in the top 500 they get ranked at "500+".
  const top = pool ?? (await computeCombinedTopUsers({ limit: 500 }));
  const idx = top.findIndex((r) => r.userId === userId);
  if (idx === -1) {
    // Fallback: still report their package + score as 0
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { package: { select: { slug: true } } },
    });
    const eligible = await getEligiblePackages();
    const slug = u?.package?.slug ?? "FREE";
    return {
      rank: 500 + 1,
      score: 0,
      isEligible: eligible.map((s) => s.toUpperCase()).includes(slug.toUpperCase()),
      packageSlug: slug,
      components: { points: 0, xp: 0, tasks: 0, team: 0 },
    };
  }
  const row = top[idx];
  return {
    rank: row.rank,
    score: row.score,
    isEligible: row.isEligible,
    packageSlug: row.packageSlug,
    components: row.components,
  };
}
