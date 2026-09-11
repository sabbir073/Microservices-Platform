/**
 * The referral reward settings — shape, defaults, and normalisation.
 *
 * Client-safe on purpose: no Prisma, no `server-only`. The admin form needs the
 * defaults and the milestone normaliser as RUNTIME values, and importing them
 * from `referral-bonus.ts` would drag the database client into the browser
 * bundle. The awarding logic stays there; this is only the description of what
 * the settings are.
 */

/**
 * One step of the milestone ladder: refer this many people, get this many
 * points. Paid ONCE per referrer per threshold.
 */
export interface ReferralMilestone {
  /** Qualified referrals needed to reach this step. */
  referrals: number;
  /** Points paid on reaching it. */
  points: number;
  /** What to call it — "Bronze", "Silver". Shown to the user. */
  label: string;
}

export interface ReferralBonusConfig {
  /**
   * Master switch for every bonus below. The multi-tier commission on task
   * earnings is separate — see `referral-commissions.ts` and the Levels page.
   */
  enabled: boolean;

  // ── 1. Sign-up (the referrer's side) ──
  signupEnabled: boolean;
  /** Instant points to the REFERRER when someone they invited registers. */
  signupPoints: number;

  // ── 2. Two-way: the person who was invited gets paid too ──
  /**
   * The half that was missing. Every "you get 100, your friend gets 100" offer
   * works because BOTH sides have a reason to act — paying only the referrer
   * gives the invitee no reason to use anyone's link.
   */
  inviteeEnabled: boolean;
  /** Instant points to the NEW USER when they sign up through a link. */
  inviteePoints: number;

  // ── 3. Milestones ──
  milestonesEnabled: boolean;
  /**
   * Thresholds, in any order — they are sorted and de-duplicated on read.
   * Crossing several at once (an import, a backfill) pays each of them.
   */
  milestones: ReferralMilestone[];

  // ── 4. Purchase-based ──
  /** Points when a referred user buys any package/subscription. */
  subscriptionEnabled: boolean;
  subscriptionPoints: number;
  /**
   * Points on the invitee's FIRST purchase of anything else — a course, a
   * marketplace item. Separate from the subscription bonus because "bought a
   * plan" and "spent money at all" are different signals and most platforms
   * price them differently.
   */
  purchaseEnabled: boolean;
  purchasePoints: number;

  // ── Month-end activity bonus ──
  monthlyEnabled: boolean;
  /** Month-end points if the referred user completed daily missions enough days. */
  monthlyPoints: number;
  /** Distinct mission-days the referred user needs in the month. */
  monthlyMinMissionDays: number;

  // ── Anti-farm gates, applied to the REFERRER's bonuses ──
  /** Referrer must be on a package with accessLevel ≥ this to earn bonuses. */
  minReferrerAccessLevel: number;
  /** Anti-farm: referrer must have completed their own daily mission today. */
  requireReferrerDailyMission: boolean;
  /**
   * Whether the invitee's own welcome half is also withheld when the referrer
   * does not qualify.
   *
   * Default false, deliberately: the invitee did nothing wrong, and the entire
   * point of the two-way model is that the new user has a reason to sign up.
   * Punishing them for the referrer's inactivity removes exactly the incentive
   * the model exists to create.
   */
  inviteeRequiresQualifiedReferrer: boolean;
}

export const REFERRAL_BONUS_DEFAULTS: ReferralBonusConfig = {
  enabled: false,
  signupEnabled: true,
  signupPoints: 0,
  inviteeEnabled: false,
  inviteePoints: 0,
  milestonesEnabled: false,
  milestones: [],
  subscriptionEnabled: true,
  subscriptionPoints: 0,
  purchaseEnabled: false,
  purchasePoints: 0,
  monthlyEnabled: true,
  monthlyPoints: 0,
  monthlyMinMissionDays: 20,
  minReferrerAccessLevel: 0,
  requireReferrerDailyMission: true,
  inviteeRequiresQualifiedReferrer: false,
};

/**
 * Sorted ascending, positive, one entry per threshold.
 *
 * Admin-entered, so it arrives unsorted, duplicated, or with junk in it.
 * Normalising here means every caller can assume a clean ascending ladder —
 * which is what lets the award loop stop at the first threshold it has not
 * reached instead of scanning all of them.
 */
export function normaliseMilestones(input: unknown): ReferralMilestone[] {
  if (!Array.isArray(input)) return [];
  const byThreshold = new Map<number, ReferralMilestone>();
  for (const raw of input) {
    const m = raw as Partial<ReferralMilestone>;
    const referrals = Math.floor(Number(m?.referrals));
    const points = Math.floor(Number(m?.points));
    if (!Number.isFinite(referrals) || referrals < 1) continue;
    if (!Number.isFinite(points) || points < 1) continue;
    byThreshold.set(referrals, {
      referrals,
      points,
      label: String(m?.label ?? "").slice(0, 40) || `${referrals} referrals`,
    });
  }
  return [...byThreshold.values()].sort((a, b) => a.referrals - b.referrals);
}
