/**
 * Pricing a buyer-funded task.
 *
 * Client-safe on purpose (no `server-only`, no Prisma): the calculator the
 * buyer reads before pressing Create and the amount `POST /api/tasks/create`
 * debits call THIS function. A quote computed in two places is a quote that
 * eventually differs by a rounding step, and a buyer reads that difference as
 * being overcharged.
 */
export interface TaskQuote {
  /** Reward pool: what the workers will collectively be paid, in points. */
  budgetPoints: number;
  /** Reward pool in USD, at the current points-per-USD rate. */
  rewardUsd: number;
  /** Platform commission in USD. */
  feeUsd: number;
  /** What the buyer is actually charged. */
  totalUsd: number;
  feePercent: number;
}

export function quoteTask(args: {
  pointsPerCompletion: number;
  completions: number;
  pointsPerUsd: number;
  feePercent: number;
}): TaskQuote {
  const budgetPoints = Math.max(
    0,
    Math.floor(args.pointsPerCompletion) * Math.floor(args.completions)
  );
  const rate = args.pointsPerUsd > 0 ? args.pointsPerUsd : 1;
  const rewardUsd = budgetPoints / rate;
  const feePercent = Math.min(100, Math.max(0, args.feePercent));
  const feeUsd = rewardUsd * (feePercent / 100);
  return {
    budgetPoints,
    rewardUsd,
    feeUsd,
    totalUsd: rewardUsd + feeUsd,
    feePercent,
  };
}
