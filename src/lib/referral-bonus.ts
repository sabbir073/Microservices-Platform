import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/system-settings";
import { creditPoints } from "@/lib/ledger";
import { isDuplicateLedgerError } from "@/lib/idempotency";
import { getPointsPerUsd } from "@/lib/economy";
import { getEffectivePackage } from "@/lib/packages";
import { getUserDayContext } from "@/lib/user-day";
import { notifyUser } from "@/lib/notify";
import {
  REFERRAL_BONUS_DEFAULTS,
  normaliseMilestones,
  type ReferralBonusConfig,
  type MilestoneActivity,
} from "@/lib/referral-config";
import { TransactionType, NotificationType } from "@/generated/prisma";

/**
 * Referral-signup bonus system (feature #9). Rewards a referrer when the person
 * they invited does things — instantly on signup, on buying a package, and a
 * month-end bonus if the invitee stayed active all month. Anti-farming: the
 * referrer only earns these while THEY themselves stay active (complete their
 * own daily mission) and meet a package-tier requirement. All amounts are
 * admin-configurable via SystemSetting `referral_bonus_config`.
 */
// The shape, defaults and milestone normaliser live in `referral-config.ts`,
// which has no Prisma import — the admin form needs them as runtime values and
// importing from here would pull the database client into the browser bundle.
export {
  REFERRAL_BONUS_DEFAULTS,
  normaliseMilestones,
  type ReferralBonusConfig,
  type ReferralMilestone,
  type MilestoneActivity,
} from "@/lib/referral-config";

const KEY = "referral_bonus_config";


export async function getReferralBonusConfig(): Promise<ReferralBonusConfig> {
  try {
    const raw = await getSetting<Partial<ReferralBonusConfig> | null>(KEY, null);
    const cfg = { ...REFERRAL_BONUS_DEFAULTS, ...(raw ?? {}) };
    // Milestones are admin-entered, so they arrive unsorted, duplicated, or
    // with junk in them. Normalising on READ means every caller can assume an
    // ascending, clean ladder instead of each one re-checking.
    cfg.milestones = normaliseMilestones(cfg.milestones);
    return cfg;
  } catch {
    return REFERRAL_BONUS_DEFAULTS;
  }
}


/** Did the referrer complete a daily mission today (their local day)? */
async function referrerActiveToday(referrerId: string): Promise<boolean> {
  try {
    const { startOfDayUtc } = await getUserDayContext(referrerId);
    const n = await prisma.dailyMissionClaim.count({
      where: { userId: referrerId, claimedAt: { gte: startOfDayUtc } },
    });
    return n > 0;
  } catch {
    return false;
  }
}

/** Does the referrer currently qualify to earn referral bonuses? */
async function referrerQualifies(
  referrerId: string,
  cfg: ReferralBonusConfig
): Promise<boolean> {
  const pkg = await getEffectivePackage(referrerId).catch(() => null);
  if ((pkg?.accessLevel ?? 0) < cfg.minReferrerAccessLevel) return false;
  if (cfg.requireReferrerDailyMission && !(await referrerActiveToday(referrerId))) {
    return false;
  }
  return true;
}

/** Shared credit path: idempotent via the ledger `reference`, writes a
 *  ReferralEarning row, and notifies the referrer. Best-effort — never throws. */
async function awardBonus(opts: {
  referrerId: string;
  referredUserId: string;
  points: number;
  reference: string;
  sourceType:
    | "SIGNUP"
    | "SUBSCRIPTION"
    | "MONTHLY_BONUS"
    | "MILESTONE"
    | "PURCHASE";
  description: string;
  notifyTitle: string;
  notifyMessage: string;
  /** Extra detail for the ledger row. */
  meta?: Record<string, unknown>;
  /**
   * Record the row even with zero points. Used to CLAIM a milestone whose
   * reward is a subscription rather than points — the reference constraint is
   * what makes the grant happen once.
   */
  allowZero?: boolean;
}): Promise<boolean> {
  if (opts.points <= 0 && !opts.allowZero) return false;
  try {
    const pointsPerUsd = await getPointsPerUsd();
    const usd = pointsPerUsd > 0 ? opts.points / pointsPerUsd : 0;
    await prisma.$transaction(async (tx) => {
      await creditPoints(tx, {
        userId: opts.referrerId,
        points: opts.points,
        type: TransactionType.REFERRAL,
        description: opts.description,
        reference: opts.reference,
        metadata: {
          referredUserId: opts.referredUserId,
          referralBonus: opts.sourceType,
          ...(opts.meta ?? {}),
        },
        pointsPerUsd,
      });
      await tx.referralEarning.create({
        data: {
          userId: opts.referrerId,
          referredUserId: opts.referredUserId,
          level: 1,
          amount: usd,
          // `ReferralSourceType` has no MILESTONE member and adding one is a
          // migration on a live enum for a label. MILESTONE is recorded as
          // SIGNUP — both are "paid for bringing people in" — and the exact
          // kind is on the ledger row's `referralBonus` metadata either way.
          sourceType: (opts.sourceType === "MILESTONE"
            ? "SIGNUP"
            : opts.sourceType) as never,
        },
      });
    });
    await notifyUser({
      userId: opts.referrerId,
      type: NotificationType.REFERRAL,
      title: opts.notifyTitle,
      message: opts.notifyMessage,
      link: "/referrals",
    }).catch(() => {});
    return true;
  } catch (err) {
    // A duplicate reference means we already paid this bonus — fine.
    if (isDuplicateLedgerError(err)) return false;
    console.error("referral bonus failed:", err);
    return false;
  }
}

/** Instant bonus when a referred user signs up. Call after registration. */
export async function awardReferralSignupBonus(
  referredUserId: string
): Promise<void> {
  const cfg = await getReferralBonusConfig();
  if (!cfg.enabled || !cfg.signupEnabled || cfg.signupPoints <= 0) return;
  const referred = await prisma.user
    .findUnique({
      where: { id: referredUserId },
      select: { referredById: true },
    })
    .catch(() => null);
  if (!referred?.referredById) return;
  if (!(await referrerQualifies(referred.referredById, cfg))) return;
  await awardBonus({
    referrerId: referred.referredById,
    referredUserId,
    points: cfg.signupPoints,
    reference: `refbonus_signup_${referredUserId}`,
    sourceType: "SIGNUP",
    description: "Referral signup bonus",
    notifyTitle: "Referral bonus!",
    notifyMessage: `You earned ${cfg.signupPoints} points for inviting a new member.`,
  });
}

/**
 * The invitee's half of a two-way referral.
 *
 * Pays the NEW USER for having arrived through someone's link. This is the
 * half that was missing: every "you get 100, your friend gets 100" offer works
 * because both sides have a reason to act, and paying only the referrer gives
 * the person actually signing up no reason to use a link at all.
 *
 * Deliberately NOT gated on the referrer's activity by default. The invitee did
 * nothing wrong if their referrer stopped logging in, and withholding it
 * removes the exact incentive the model exists to create. The admin can turn
 * that gate on with `inviteeRequiresQualifiedReferrer`.
 *
 * Idempotent: one reference per invited user, so a re-run of signup rewards
 * (verification retried, Google callback repeated) cannot pay twice.
 */
export async function awardInviteeSignupBonus(
  referredUserId: string
): Promise<void> {
  const cfg = await getReferralBonusConfig();
  if (!cfg.enabled || !cfg.inviteeEnabled || cfg.inviteePoints <= 0) return;

  const referred = await prisma.user
    .findUnique({
      where: { id: referredUserId },
      select: { referredById: true },
    })
    .catch(() => null);
  // No referrer means they arrived on their own — there is nothing two-way
  // about it, and paying would make the bonus universal rather than a referral.
  if (!referred?.referredById) return;

  if (
    cfg.inviteeRequiresQualifiedReferrer &&
    !(await referrerQualifies(referred.referredById, cfg))
  ) {
    return;
  }

  try {
    const pointsPerUsd = await getPointsPerUsd();
    await prisma.$transaction(async (tx) => {
      await creditPoints(tx, {
        userId: referredUserId,
        points: cfg.inviteePoints,
        type: TransactionType.REFERRAL,
        description: "Welcome bonus for joining through an invite",
        reference: `refbonus_invitee_${referredUserId}`,
        metadata: {
          referrerId: referred.referredById,
          referralBonus: "INVITEE_SIGNUP",
        },
        pointsPerUsd,
      });
    });
    await notifyUser({
      userId: referredUserId,
      type: NotificationType.REFERRAL,
      title: "Welcome bonus!",
      message: `You got ${cfg.inviteePoints} points for joining through an invite.`,
      link: "/referrals",
    }).catch(() => {});
  } catch (err) {
    if (isDuplicateLedgerError(err)) return;
    console.error("invitee signup bonus failed:", err);
  }
}

/**
 * How many of a referrer's invitees are genuinely ACTIVE.
 *
 * `UserStatus.ACTIVE` on its own means "not banned" — nothing more. Counting
 * that would let someone reach a milestone, and collect a free subscription,
 * on a hundred accounts that registered and were never seen again. When the
 * prize is a month of a paid plan, the bar has to be higher than "exists".
 *
 * So activity is measured: a claimed daily mission or an approved task, on at
 * least `minActiveDays` DISTINCT days inside the window. Distinct days is the
 * part that matters — twenty submissions in one sitting is one day of being
 * active, and counting events instead would make a single burst look like a
 * month of engagement.
 *
 * `minActiveDays: 0` restores the old "any live account" behaviour for an admin
 * who wants the simpler rule.
 */
export async function qualifiedReferralCount(
  referrerId: string,
  activity?: MilestoneActivity
): Promise<number> {
  const live = await prisma.user.findMany({
    where: { referredById: referrerId, status: "ACTIVE" },
    select: { id: true },
  });
  if (live.length === 0) return 0;

  const minDays = Math.max(0, Math.floor(activity?.minActiveDays ?? 0));
  if (minDays === 0) return live.length;

  const windowDays = Math.max(1, Math.floor(activity?.windowDays ?? 30));
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const ids = live.map((u) => u.id);

  // Two signals, because a user who does tasks but ignores the daily mission is
  // still plainly active, and vice versa.
  const [missions, submissions] = await Promise.all([
    prisma.dailyMissionClaim.findMany({
      where: { userId: { in: ids }, claimedAt: { gte: since } },
      select: { userId: true, claimedAt: true },
    }),
    prisma.taskSubmission.findMany({
      where: {
        userId: { in: ids },
        createdAt: { gte: since },
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
      },
      select: { userId: true, createdAt: true },
    }),
  ]);

  const daysByUser = new Map<string, Set<string>>();
  const mark = (userId: string, when: Date) => {
    const day = when.toISOString().slice(0, 10);
    const set = daysByUser.get(userId) ?? new Set<string>();
    set.add(day);
    daysByUser.set(userId, set);
  };
  for (const m of missions) mark(m.userId, m.claimedAt);
  for (const t of submissions) mark(t.userId, t.createdAt);

  let n = 0;
  for (const id of ids) {
    if ((daysByUser.get(id)?.size ?? 0) >= minDays) n++;
  }
  return n;
}

/**
 * Grant a free subscription as a milestone reward.
 *
 * Extends from the CURRENT expiry when the user already has time on a plan,
 * rather than overwriting it — someone who just paid for a month and then earns
 * one should end up with two, not with their purchase quietly replaced.
 *
 * Idempotency is the caller's: it only runs after `awardBonus`-style reference
 * checking, so a repeated milestone cannot grant twice.
 */
async function grantMilestoneSubscription(
  referrerId: string,
  packageId: string,
  months: number
): Promise<boolean> {
  const pkg = await prisma.package
    .findUnique({ where: { id: packageId }, select: { id: true, name: true } })
    .catch(() => null);
  // A deleted plan must not silently pay nothing — the caller reports false and
  // the milestone stays unpaid rather than being marked done.
  if (!pkg) return false;

  const me = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { packageExpiresAt: true },
  });
  const now = new Date();
  const base =
    me?.packageExpiresAt && me.packageExpiresAt > now ? me.packageExpiresAt : now;
  const end = new Date(base);
  end.setMonth(end.getMonth() + Math.max(1, months));

  await prisma.user.update({
    where: { id: referrerId },
    data: { packageId: pkg.id, packageExpiresAt: end },
  });
  return true;
}

/**
 * Pay any milestone this referrer has now reached.
 *
 * Called after a referral becomes active. Every threshold at or below the
 * current count is paid, not just the highest — a backfill or an import can
 * cross several at once, and skipping the ones in between would quietly owe
 * somebody money. Each is idempotent on its own reference, so re-running pays
 * nothing twice.
 */
export async function awardReferralMilestones(
  referrerId: string
): Promise<number> {
  const cfg = await getReferralBonusConfig();
  if (!cfg.enabled || !cfg.milestonesEnabled || cfg.milestones.length === 0) {
    return 0;
  }
  if (!(await referrerQualifies(referrerId, cfg))) return 0;

  const count = await qualifiedReferralCount(referrerId, cfg.milestoneActivity);
  let paid = 0;

  for (const m of cfg.milestones) {
    if (count < m.referrals) break; // sorted ascending — the rest are further off

    if (m.rewardType === "SUBSCRIPTION") {
      // Claim the step FIRST, with a zero-point ledger row, so the reference
      // constraint is what stops a second grant. Granting the plan first and
      // recording after would hand out a free month on every re-run.
      const claimed = await awardBonus({
        referrerId,
        referredUserId: referrerId,
        points: 0,
        allowZero: true,
        reference: `refbonus_milestone_${referrerId}_${m.referrals}`,
        sourceType: "MILESTONE",
        description: `Referral milestone — ${m.label}`,
        notifyTitle: `Milestone reached: ${m.label}`,
        notifyMessage: `You've invited ${m.referrals} active members — your free subscription is on its way.`,
        meta: { rewardType: "SUBSCRIPTION", packageId: m.packageId, months: m.months },
      });
      if (!claimed) continue;

      const granted = await grantMilestoneSubscription(
        referrerId,
        m.packageId,
        m.months
      );
      if (granted) {
        paid++;
      } else {
        // The plan is gone. Leave a trail rather than failing silently — the
        // referrer earned something the platform could not deliver.
        console.error(
          `milestone ${m.referrals} for ${referrerId}: package ${m.packageId} not found`
        );
      }
      continue;
    }

    const ok = await awardBonus({
      referrerId,
      // A milestone is about the referrer's own total, not one invitee, so
      // there is no single referred user to attribute it to.
      referredUserId: referrerId,
      points: m.points,
      reference: `refbonus_milestone_${referrerId}_${m.referrals}`,
      sourceType: "MILESTONE",
      description: `Referral milestone — ${m.label}`,
      notifyTitle: `Milestone reached: ${m.label}`,
      notifyMessage: `You've invited ${m.referrals} active members and earned ${m.points} points.`,
    });
    if (ok) paid++;
  }
  return paid;
}

/**
 * Bonus on the invitee's first purchase of anything that is not a package.
 *
 * Separate from the subscription bonus because "bought a plan" and "spent money
 * at all" are different signals, and most platforms want to price them
 * differently. Keyed on the referred user rather than the order, so it pays
 * once — on the FIRST purchase, which is what the model is for.
 */
export async function awardReferralPurchaseBonus(
  referredUserId: string,
  sourceRef: string
): Promise<void> {
  const cfg = await getReferralBonusConfig();
  if (!cfg.enabled || !cfg.purchaseEnabled || cfg.purchasePoints <= 0) return;
  const referred = await prisma.user
    .findUnique({
      where: { id: referredUserId },
      select: { referredById: true },
    })
    .catch(() => null);
  if (!referred?.referredById) return;
  if (!(await referrerQualifies(referred.referredById, cfg))) return;
  await awardBonus({
    referrerId: referred.referredById,
    referredUserId,
    points: cfg.purchasePoints,
    // Per USER, not per order: "first purchase" pays once however many they
    // go on to make.
    reference: `refbonus_purchase_${referredUserId}`,
    sourceType: "PURCHASE",
    description: "Referral first-purchase bonus",
    notifyTitle: "Referral bonus!",
    notifyMessage: `Your invitee made their first purchase — you earned ${cfg.purchasePoints} points.`,
    meta: { sourceRef },
  });
}

/**
 * A cut of what an invitee deposits or withdraws, paid to their referrer.
 *
 * The percentage is of the MONEY MOVED, converted to points at the current
 * rate. It comes out of the platform's margin, never out of the user's own
 * deposit or payout — a referral programme that quietly shaved the invitee's
 * money would be the platform charging them for having used a link.
 *
 * Idempotent per movement: the deposit or withdrawal id is the reference, so a
 * webhook replay or an admin re-approving pays once.
 */
export async function awardReferralMoneyBonus(
  referredUserId: string,
  kind: "DEPOSIT" | "WITHDRAWAL",
  amountUsd: number,
  sourceRef: string
): Promise<void> {
  if (!(amountUsd > 0)) return;
  const cfg = await getReferralBonusConfig();
  if (!cfg.enabled) return;

  const on = kind === "DEPOSIT" ? cfg.depositEnabled : cfg.withdrawalEnabled;
  const pct = kind === "DEPOSIT" ? cfg.depositPercent : cfg.withdrawalPercent;
  if (!on || !(pct > 0)) return;

  const referred = await prisma.user
    .findUnique({
      where: { id: referredUserId },
      select: { referredById: true },
    })
    .catch(() => null);
  if (!referred?.referredById) return;
  if (!(await referrerQualifies(referred.referredById, cfg))) return;

  const pointsPerUsd = await getPointsPerUsd();
  const points = Math.floor((amountUsd * (pct / 100)) * pointsPerUsd);
  if (points <= 0) return;

  const verb = kind === "DEPOSIT" ? "deposited" : "withdrew";
  await awardBonus({
    referrerId: referred.referredById,
    referredUserId,
    points,
    reference: `refbonus_${kind.toLowerCase()}_${sourceRef}`,
    sourceType: kind === "DEPOSIT" ? "PURCHASE" : "MONTHLY_BONUS",
    description: `Referral ${kind.toLowerCase()} bonus (${pct}%)`,
    notifyTitle: "Referral bonus!",
    notifyMessage: `Someone you invited ${verb} funds — you earned ${points.toLocaleString()} points.`,
    meta: { kind, pct, amountUsd },
  });
}

/** Bonus when a referred user buys a package/subscription. */
export async function awardReferralSubscriptionBonus(
  referredUserId: string,
  sourceRef: string
): Promise<void> {
  const cfg = await getReferralBonusConfig();
  if (!cfg.enabled || !cfg.subscriptionEnabled || cfg.subscriptionPoints <= 0)
    return;
  const referred = await prisma.user
    .findUnique({
      where: { id: referredUserId },
      select: { referredById: true },
    })
    .catch(() => null);
  if (!referred?.referredById) return;
  if (!(await referrerQualifies(referred.referredById, cfg))) return;
  await awardBonus({
    referrerId: referred.referredById,
    referredUserId,
    points: cfg.subscriptionPoints,
    reference: `refbonus_sub_${sourceRef}`,
    sourceType: "SUBSCRIPTION",
    description: "Referral subscription bonus",
    notifyTitle: "Referral bonus!",
    notifyMessage: `Your invitee upgraded — you earned ${cfg.subscriptionPoints} points.`,
  });
}

/**
 * Month-end sweep: for each referred user who completed daily missions on at
 * least `monthlyMinMissionDays` distinct days in the given month, pay the
 * referrer (if the referrer still qualifies). Idempotent per (referrer,
 * referredUser, month). `monthKey` = "YYYY-MM".
 */
export async function runMonthlyReferralBonuses(
  monthStart: Date,
  monthEnd: Date,
  monthKey: string
): Promise<{ paid: number; points: number; scanned: number; drained: boolean }> {
  const cfg = await getReferralBonusConfig();
  if (!cfg.enabled || cfg.monthlyPoints <= 0)
    return { paid: 0, points: 0, scanned: 0, drained: true };

  // Candidates: referred users active in the window, walked in PAGES.
  //
  // This used to be one unbounded groupBy over the whole month followed by a
  // sequential per-user loop of 3-4 queries. At 100k monthly-active users that
  // is ~400k serial round-trips in a single run: it times out, and because the
  // retry restarts from zero it never finishes. It is idempotent (awardBonus is
  // keyed on a unique reference) so nobody was ever double-paid — the bonus just
  // silently stopped being paid at scale.
  //
  // Now: page through candidates, and resolve each page's referrer + active-day
  // counts in BULK rather than per user.
  const PAGE = 500;
  const BUDGET_MS = 240_000; // leave headroom inside the function timeout
  const deadline = Date.now() + BUDGET_MS;

  let paid = 0;
  let points = 0;
  let scanned = 0;
  let cursor: string | undefined;
  let drained = false;

  for (;;) {
    const page = (await prisma.dailyMissionClaim.groupBy({
      by: ["userId"],
      where: { claimedAt: { gte: monthStart, lt: monthEnd } },
      _count: { _all: true },
      orderBy: { userId: "asc" },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { userId: cursor } } : {}),
    })) as unknown as { userId: string }[];

    if (page.length === 0) {
      drained = true;
      break;
    }
    cursor = page[page.length - 1]!.userId;
    scanned += page.length;
    const ids = page.map((c) => c.userId);

    // Distinct active days per user for the whole page, in one query.
    const dayRows = await prisma.dailyMissionClaim.findMany({
      where: { userId: { in: ids }, claimedAt: { gte: monthStart, lt: monthEnd } },
      select: { userId: true, date: true },
      distinct: ["userId", "date"],
    });
    const daysByUser = new Map<string, number>();
    for (const row of dayRows) {
      daysByUser.set(row.userId, (daysByUser.get(row.userId) ?? 0) + 1);
    }

    // Referrer for the whole page, in one query.
    const referredRows = await prisma.user.findMany({
      where: { id: { in: ids }, referredById: { not: null } },
      select: { id: true, referredById: true },
    });
    const referrerByUser = new Map(
      referredRows.map((u) => [u.id, u.referredById as string])
    );

    // referrerQualifies() is per referrer, not per referred user — cache it so a
    // referrer with 50 invitees is checked once, not 50 times.
    const qualifies = new Map<string, boolean>();

    for (const id of ids) {
      if ((daysByUser.get(id) ?? 0) < cfg.monthlyMinMissionDays) continue;
      const referrerId = referrerByUser.get(id);
      if (!referrerId) continue;

      let ok = qualifies.get(referrerId);
      if (ok === undefined) {
        ok = await referrerQualifies(referrerId, cfg);
        qualifies.set(referrerId, ok);
      }
      if (!ok) continue;

      const awarded = await awardBonus({
        referrerId,
        referredUserId: id,
        points: cfg.monthlyPoints,
        reference: `refbonus_month_${id}_${monthKey}`,
        sourceType: "MONTHLY_BONUS",
        description: `Referral monthly bonus (${monthKey})`,
        notifyTitle: "Monthly referral bonus!",
        notifyMessage: `An invitee stayed active all month — you earned ${cfg.monthlyPoints} points.`,
      });
      if (awarded) {
        paid += 1;
        points += cfg.monthlyPoints;
      }
    }

    if (page.length < PAGE) {
      drained = true;
      break;
    }
    // Out of budget. The run is idempotent, so the next invocation re-scans and
    // simply skips everyone already paid.
    if (Date.now() >= deadline) break;
  }

  return { paid, points, scanned, drained };
}

/** Convenience for the monthly cron: sweep the just-ended calendar month. */
export async function runPreviousMonthReferralBonuses(): Promise<{
  paid: number;
  points: number;
  scanned: number;
  drained: boolean;
}> {
  const now = new Date();
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const prevMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );
  const monthKey = `${prevMonthStart.getUTCFullYear()}-${String(
    prevMonthStart.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  return runMonthlyReferralBonuses(prevMonthStart, thisMonthStart, monthKey);
}
