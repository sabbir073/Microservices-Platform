import { prisma } from "@/lib/prisma";

/**
 * Single feature flag a Plan can toggle on/off. Maps 1:1 to a `*Enabled`
 * boolean column on the Package table.
 */
export type PackageFeatureKey =
  // Section-level
  | "tasks"
  | "socialFeed"
  | "referrals"
  | "withdrawals"
  | "marketplace"
  | "boost"
  | "dailyMission"
  | "lottery"
  | "courses"
  // Per-task-type
  | "socialTasks"
  | "proxyTasks"
  | "articleTasks"
  | "videoTasks"
  | "quizTasks"
  | "surveyTasks"
  | "offerwallTasks";

const FEATURE_TO_COLUMN: Record<PackageFeatureKey, string> = {
  tasks: "tasksEnabled",
  socialFeed: "socialFeedEnabled",
  referrals: "referralsEnabled",
  withdrawals: "withdrawalsEnabled",
  marketplace: "marketplaceEnabled",
  boost: "boostEnabled",
  dailyMission: "dailyMissionEnabled",
  lottery: "lotteryEnabled",
  courses: "coursesEnabled",
  socialTasks: "socialTasksEnabled",
  proxyTasks: "proxyTasksEnabled",
  articleTasks: "articleTasksEnabled",
  videoTasks: "videoTasksEnabled",
  quizTasks: "quizTasksEnabled",
  surveyTasks: "surveyTasksEnabled",
  offerwallTasks: "offerwallTasksEnabled",
};

// Concrete PackageRow type — Prisma Accelerate's `Awaited<ReturnType<...>>`
// inference returns `{}` for findFirst/findUnique results, so we declare
// the row shape explicitly. Keep in sync with `model Package` in schema.prisma.
export interface PackageRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accessLevel: number;
  isDefault: boolean;
  priceMonthly: number;
  priceYearly: number | null;
  validityDays: number | null;
  tasksEnabled: boolean;
  socialFeedEnabled: boolean;
  referralsEnabled: boolean;
  withdrawalsEnabled: boolean;
  marketplaceEnabled: boolean;
  boostEnabled: boolean;
  dailyMissionEnabled: boolean;
  lotteryEnabled: boolean;
  coursesEnabled: boolean;
  adFree: boolean;
  socialTasksEnabled: boolean;
  proxyTasksEnabled: boolean;
  articleTasksEnabled: boolean;
  videoTasksEnabled: boolean;
  quizTasksEnabled: boolean;
  surveyTasksEnabled: boolean;
  offerwallTasksEnabled: boolean;
  dailyTaskLimit: number;
  minWithdrawal: number;
  withdrawalFeeDiscount: number;
  xpMultiplier: number;
  taskRewardMultiplier: number;
  socialEarningMultiplier: number;
  dailyReferralPoints: number;
  referralCommissionLevels: number;
  features: string[];
  badgeColor: string | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolve the package the user currently has access to.
 *
 *   - If `packageId` resolves to an active Package and `packageExpiresAt > now()`
 *     → return that Package.
 *   - Otherwise → return the system default (`isDefault=true`) Package.
 *
 * Returns `null` only if there is no default plan seeded — that is a
 * misconfiguration and callers should error or fall back to FREE-equivalent
 * behavior.
 */
export async function getEffectivePackage(
  userId: string
): Promise<PackageRow | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      packageId: true,
      packageExpiresAt: true,
      package: true,
    },
  });

  if (!user) return defaultPackage();

  // Expired premium subs fall back to default.
  const subActive =
    user.package &&
    user.package.isActive &&
    (user.packageExpiresAt == null ||
      user.packageExpiresAt.getTime() > Date.now());

  if (subActive) return user.package as unknown as PackageRow;

  return defaultPackage();
}

/**
 * The platform's default plan. Every new user is implicitly on this when
 * their `packageId` is null or their subscription has expired.
 */
export async function defaultPackage(): Promise<PackageRow | null> {
  const row = await prisma.package.findFirst({
    where: { isDefault: true, isActive: true },
  });
  return (row as unknown as PackageRow | null) ?? null;
}

/**
 * `true` if the user's effective package has the given feature flag on.
 * Returns `false` (deny) when no package is resolvable — fail closed.
 */
export async function userCan(
  userId: string,
  feature: PackageFeatureKey
): Promise<boolean> {
  const pkg = await getEffectivePackage(userId);
  if (!pkg) return false;
  const column = FEATURE_TO_COLUMN[feature];
  return Boolean((pkg as unknown as Record<string, unknown>)[column]);
}

/** Convenience: true if the package row has the flag on. Useful when caller
 *  already loaded the package row to avoid a redundant fetch. */
export function packageHasFeature(
  pkg: PackageRow | null | undefined,
  feature: PackageFeatureKey
): boolean {
  if (!pkg) return false;
  const column = FEATURE_TO_COLUMN[feature];
  return Boolean((pkg as unknown as Record<string, unknown>)[column]);
}

/** Effective access level for tasks/quizzes/missions gating. */
export async function userAccessLevel(userId: string): Promise<number> {
  const pkg = await getEffectivePackage(userId);
  return pkg?.accessLevel ?? 0;
}

/**
 * Subscription metadata for display: what's the user's raw plan, is it
 * expired, and what's the effective plan they fall back to?
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  effective: PackageRow | null;
  rawPackageId: string | null;
  expired: boolean;
  expiresAt: Date | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      packageId: true,
      packageExpiresAt: true,
    },
  });
  if (!user) {
    return {
      effective: await defaultPackage(),
      rawPackageId: null,
      expired: false,
      expiresAt: null,
    };
  }

  const expired =
    !!user.packageId &&
    !!user.packageExpiresAt &&
    user.packageExpiresAt.getTime() <= Date.now();

  const effective = await getEffectivePackage(userId);

  return {
    effective,
    rawPackageId: user.packageId,
    expired,
    expiresAt: user.packageExpiresAt,
  };
}
