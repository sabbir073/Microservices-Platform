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
  /** Platform commission, in task-credit points. */
  feePoints: number;
  /** What leaves the buyer's task credit: reward pool + fee, in points. */
  totalPoints: number;
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
  const feePercent = Math.min(100, Math.max(0, args.feePercent));

  // The fee is charged in POINTS, because task credit is what a buyer holds
  // and what the budget is denominated in. Rounded UP: a fee that rounds to
  // zero on small tasks would let a buyer split one large task into many tiny
  // ones and pay no commission at all.
  const feePoints =
    feePercent > 0 ? Math.ceil((budgetPoints * feePercent) / 100) : 0;
  const totalPoints = budgetPoints + feePoints;

  // USD figures are the same numbers valued at the current rate, for the
  // ledger and for anyone who thinks in dollars.
  const rewardUsd = budgetPoints / rate;
  const feeUsd = feePoints / rate;
  return {
    budgetPoints,
    feePoints,
    totalPoints,
    rewardUsd,
    feeUsd,
    totalUsd: rewardUsd + feeUsd,
    feePercent,
  };
}
