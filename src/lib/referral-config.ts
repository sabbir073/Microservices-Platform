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
  /**
   * Stable identity of this step, and the ONLY thing the payout reference is
   * keyed on.
   *
   * The reference used to be `refbonus_milestone_<referrerId>_<threshold>`.
   * That made the threshold the identity: an admin editing "Bronze" from 10
   * referrals to 12 minted a brand-new key, so the ledger's unique constraint
   * saw a bonus it had never paid and paid everyone who had already passed the
   * step a second time — free subscription months included.
   *
   * Legacy entries have no `id`. `normaliseMilestones` gives them
   * `String(referrals)`, which reproduces the old reference EXACTLY, so steps
   * already paid stay paid and are not re-paid on the first load after this
   * change. New steps get a random id that cannot collide with a numeric one.
   */
  id: string;
  /** ACTIVE referrals needed to reach this step — see `milestoneActivity`. */
  referrals: number;
  /**
   * What they get.
   *
   * "Bring 100 active users and get a month of Gold" is a different promise
   * from "get 5,000 points", and it is the one that moves people: a
   * subscription has a price they already know and a value they already want.
   */
  rewardType: "POINTS" | "SUBSCRIPTION";
  /** Points paid on reaching it. Used when `rewardType` is POINTS. */
  points: number;
  /** Which plan to grant. Used when `rewardType` is SUBSCRIPTION. */
  packageId: string;
  /** How many months of it. Used when `rewardType` is SUBSCRIPTION. */
  months: number;
  /** What to call it — "Bronze", "Silver". Shown to the user. */
  label: string;
}

/**
 * What counts as an "active" referral for the milestone ladder.
 *
 * `UserStatus.ACTIVE` only means "not banned" — it says nothing about whether
 * the person has ever done anything, so counting it would let someone climb the
 * ladder on a pile of registered-and-abandoned accounts. A milestone that pays
 * a free subscription has to be harder to farm than that.
 *
 * "Active" here means the invitee actually turned up: a claimed daily mission
 * or an approved task on at least `minActiveDays` DISTINCT days inside the last
 * `windowDays`. Distinct days, not events — twenty tasks in one sitting is one
 * day of activity, which is what stops a single burst from qualifying.
 */
export interface MilestoneActivity {
  /** Distinct days with activity required. 0 → any non-banned account counts. */
  minActiveDays: number;
  /** How far back to look, in days. */
  windowDays: number;
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

  /** How strictly an invitee has to have engaged to count toward a milestone. */
  milestoneActivity: MilestoneActivity;

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

  // ── Money movement: a cut of what invitees deposit and withdraw ──
  /**
   * A percentage of every deposit an invitee makes, paid to the referrer.
   *
   * This is the one that makes a referral programme pay for itself: the
   * referrer keeps earning as their invitee keeps using the platform, so
   * bringing people in is worth doing properly rather than once.
   */
  depositEnabled: boolean;
  depositPercent: number;
  /** The same on withdrawals — paid from the platform, not out of the payout. */
  withdrawalEnabled: boolean;
  withdrawalPercent: number;

  // ── Anti-farm guard for the two money bonuses above ──
  /**
   * THE ATTACK, stated plainly so nobody removes this without replacing it:
   *
   * With `depositEnabled` and `withdrawalEnabled` both on, an invitee deposits
   * $100, withdraws $100, deposits it again, and repeats. The money never
   * leaves the attacker — only the withdrawal fee does — but the referrer is
   * paid `depositPercent + withdrawalPercent` of $100 on every lap. One person
   * with two accounts mints referral points for as long as they keep clicking.
   *
   * Two rules stop it, and neither touches an honest user:
   *
   *   1. EARNED-ONLY WITHDRAWALS (`withdrawalBonusEarnedOnly`). The withdrawal
   *      bonus is paid only on the part of a payout the invitee actually EARNED
   *      on the platform — lifetime `totalEarnings`, which deposits never
   *      increment — less whatever has already been bonus-paid. Money that was
   *      merely deposited and sent back is worth nothing on the way out, so the
   *      loop pays the withdrawal leg exactly once and then zero forever.
   *   2. A PER-INVITEE CEILING (`moneyBonusMaxPointsPerUser` over
   *      `moneyBonusWindowDays`). Caps what ONE referred user's deposits and
   *      withdrawals can ever be worth to their referrer in a rolling window,
   *      which bounds the deposit leg too. A partially-available cap pays the
   *      remaining headroom rather than nothing, so a real user near the limit
   *      is not silently cut off.
   */
  /** Rolling window, in days, the per-invitee ceiling is measured over. */
  moneyBonusWindowDays: number;
  /**
   * Most points ONE referred user's money movements can earn their referrer
   * inside that window. 0 disables the ceiling — which re-opens the deposit
   * leg of the loop above, so it is not the default.
   */
  moneyBonusMaxPointsPerUser: number;
  /** Rule 1 above. Off means a round-trip deposit pays a withdrawal bonus. */
  withdrawalBonusEarnedOnly: boolean;

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
  milestoneActivity: { minActiveDays: 5, windowDays: 30 },
  subscriptionEnabled: true,
  subscriptionPoints: 0,
  purchaseEnabled: false,
  purchasePoints: 0,
  depositEnabled: false,
  depositPercent: 0,
  withdrawalEnabled: false,
  withdrawalPercent: 0,
  moneyBonusWindowDays: 30,
  moneyBonusMaxPointsPerUser: 10000,
  withdrawalBonusEarnedOnly: true,
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
    if (!Number.isFinite(referrals) || referrals < 1) continue;

    // The step's identity, kept across an edit of its threshold. A stored id
    // wins. A legacy entry (no id) gets `String(referrals)` — deliberately the
    // threshold it has RIGHT NOW, because that reproduces the old reference
    // `refbonus_milestone_<referrerId>_<threshold>` byte for byte and so the
    // first load after this change re-pays nobody. From then on the id is
    // frozen in the saved config and the threshold can move freely.
    const id =
      typeof m?.id === "string" && m.id.trim() !== ""
        ? m.id.trim().slice(0, 40)
        : String(referrals);

    const rewardType = m?.rewardType === "SUBSCRIPTION" ? "SUBSCRIPTION" : "POINTS";
    const points = Math.floor(Number(m?.points)) || 0;
    const months = Math.min(24, Math.max(1, Math.floor(Number(m?.months)) || 1));
    const packageId = String(m?.packageId ?? "");

    // A step that cannot pay anything is dropped rather than stored: it would
    // sit in the ladder looking like a reward and silently give nothing.
    if (rewardType === "POINTS" && points < 1) continue;
    if (rewardType === "SUBSCRIPTION" && !packageId) continue;

    byThreshold.set(referrals, {
      id,
      referrals,
      rewardType,
      points,
      packageId,
      months,
      label: String(m?.label ?? "").slice(0, 40) || `${referrals} referrals`,
    });
  }
  return [...byThreshold.values()].sort((a, b) => a.referrals - b.referrals);
}

/**
 * Identity for a milestone the admin is adding right now.
 *
 * Prefixed and non-numeric on purpose: a legacy step's derived id is the bare
 * threshold ("10"), so nothing generated here can ever collide with one and
 * accidentally claim a payout that was already made.
 */
export function newMilestoneId(): string {
  const rnd =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `ms_${rnd}`;
}
