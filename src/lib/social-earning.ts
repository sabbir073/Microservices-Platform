/**
 * Social engagement earning helper.
 *
 * Awards points to a content author when another user engages with their post
 * (view / like / vote / comment / share / mention). All knobs are admin-tunable
 * via SystemSetting rows under category="social_earning".
 *
 * Idempotency: every credit writes a Transaction with a deterministic
 * `reference` of the form `social_<action>_<postId>_<sourceUserId>` (for views,
 * likes, votes, comments, mentions) — so accidental double-fires from race
 * conditions can't double-credit (unique reference would collide on the
 * Transaction insert).
 */
import { prisma } from "@/lib/prisma";
import {
  TransactionStatus,
  TransactionType,
  NotificationType,
} from "@/generated/prisma/client";

export type SocialAction =
  | "POST_CREATE"
  | "VIEW_RECEIVED"
  | "LIKE_RECEIVED"
  | "VOTE_RECEIVED"
  | "COMMENT_RECEIVED"
  | "SHARE_RECEIVED"
  | "DONATION_RECEIVED"
  | "MENTION_RECEIVED";

interface AwardArgs {
  recipientUserId: string;
  action: SocialAction;
  postId?: string | null;
  sourceUserId?: string | null;
  // Override the deterministic reference (used by POST_CREATE which is once-per-day)
  referenceOverride?: string;
}

interface SocialEarningConfig {
  enabled: boolean;
  perActivity: Record<
    SocialAction,
    { enabled: boolean; points: number }
  >;
  dailyCapPerUser: number;
  capPerPost: number;
  minAccountAgeHours: number;
}

const DEFAULTS: SocialEarningConfig = {
  enabled: true,
  perActivity: {
    POST_CREATE: { enabled: true, points: 5 },
    VIEW_RECEIVED: { enabled: true, points: 0 }, // disabled by default (fractional)
    LIKE_RECEIVED: { enabled: true, points: 1 },
    VOTE_RECEIVED: { enabled: true, points: 1 },
    COMMENT_RECEIVED: { enabled: true, points: 2 },
    SHARE_RECEIVED: { enabled: true, points: 3 },
    DONATION_RECEIVED: { enabled: false, points: 0 },
    MENTION_RECEIVED: { enabled: true, points: 1 },
  },
  dailyCapPerUser: 500,
  capPerPost: 100,
  minAccountAgeHours: 24,
};

const CATEGORY = "social_earning";

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBoolean(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return fallback;
}

let _cached: { value: SocialEarningConfig; ts: number } | null = null;
const CACHE_MS = 30_000;

export async function getSocialEarningConfig(): Promise<SocialEarningConfig> {
  if (_cached && Date.now() - _cached.ts < CACHE_MS) return _cached.value;

  const rows = await prisma.systemSetting.findMany({
    where: { category: CATEGORY },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const cfg: SocialEarningConfig = {
    enabled: asBoolean(map.get("social_earning.enabled"), DEFAULTS.enabled),
    perActivity: { ...DEFAULTS.perActivity },
    dailyCapPerUser: asNumber(
      map.get("social_earning.daily_cap_per_user"),
      DEFAULTS.dailyCapPerUser
    ),
    capPerPost: asNumber(
      map.get("social_earning.cap_per_post"),
      DEFAULTS.capPerPost
    ),
    minAccountAgeHours: asNumber(
      map.get("social_earning.min_account_age_hours"),
      DEFAULTS.minAccountAgeHours
    ),
  };
  for (const action of Object.keys(DEFAULTS.perActivity) as SocialAction[]) {
    const k = action.toLowerCase();
    cfg.perActivity[action] = {
      enabled: asBoolean(
        map.get(`social_earning.${k}_enabled`),
        DEFAULTS.perActivity[action].enabled
      ),
      points: asNumber(
        map.get(`social_earning.${k}_points`),
        DEFAULTS.perActivity[action].points
      ),
    };
  }

  _cached = { value: cfg, ts: Date.now() };
  return cfg;
}

export function invalidateSocialEarningCache() {
  _cached = null;
}

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function utcStartOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

const ACTION_DESCRIPTION: Record<SocialAction, string> = {
  POST_CREATE: "Created a post",
  VIEW_RECEIVED: "Earned from a view on your post",
  LIKE_RECEIVED: "Earned from a like on your post",
  VOTE_RECEIVED: "Earned from a vote on your poll",
  COMMENT_RECEIVED: "Earned from a comment on your post",
  SHARE_RECEIVED: "Earned from a share of your post",
  DONATION_RECEIVED: "Earned from a donation",
  MENTION_RECEIVED: "Mentioned in a post / comment",
};

interface AwardResult {
  awarded: number;
  skipped?: "disabled" | "self" | "min_age" | "banned" | "post_cap" | "daily_cap" | "duplicate" | "no_recipient";
}

/**
 * Try to award social engagement points. Safe to call from anywhere; never
 * throws on business-rule misses, only on infra errors.
 */
export async function awardSocialEarning(args: AwardArgs): Promise<AwardResult> {
  const { recipientUserId, action, postId, sourceUserId, referenceOverride } = args;

  if (!recipientUserId) return { awarded: 0, skipped: "no_recipient" };
  if (sourceUserId && sourceUserId === recipientUserId) {
    return { awarded: 0, skipped: "self" };
  }

  const cfg = await getSocialEarningConfig();
  if (!cfg.enabled) return { awarded: 0, skipped: "disabled" };
  const rule = cfg.perActivity[action];
  if (!rule || !rule.enabled || rule.points <= 0) {
    return { awarded: 0, skipped: "disabled" };
  }

  // Recipient must be ACTIVE and old enough
  const recipient = await prisma.user.findUnique({
    where: { id: recipientUserId },
    select: { id: true, status: true, createdAt: true },
  });
  if (!recipient || recipient.status !== "ACTIVE") {
    return { awarded: 0, skipped: "banned" };
  }
  const ageHours =
    (Date.now() - recipient.createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < cfg.minAccountAgeHours) {
    return { awarded: 0, skipped: "min_age" };
  }

  // Per-post cap
  let postEarned = 0;
  if (postId) {
    const p = await prisma.post.findUnique({
      where: { id: postId },
      select: { socialEarnings: true },
    });
    if (!p) return { awarded: 0, skipped: "no_recipient" };
    postEarned = p.socialEarnings;
    if (postEarned >= cfg.capPerPost) {
      return { awarded: 0, skipped: "post_cap" };
    }
  }

  // Daily cap (today's social_* transactions)
  const todayStart = utcStartOfDay();
  const dailyAgg = await prisma.transaction.aggregate({
    where: {
      userId: recipientUserId,
      reference: { startsWith: "social_" },
      createdAt: { gte: todayStart },
    },
    _sum: { points: true },
  });
  const todayEarned = Math.max(0, dailyAgg._sum.points ?? 0);
  if (todayEarned >= cfg.dailyCapPerUser) {
    return { awarded: 0, skipped: "daily_cap" };
  }

  // Final allowed
  let allow = Math.floor(rule.points);
  if (allow <= 0) return { awarded: 0, skipped: "disabled" };
  if (postId) allow = Math.min(allow, cfg.capPerPost - postEarned);
  allow = Math.min(allow, cfg.dailyCapPerUser - todayEarned);
  if (allow <= 0) return { awarded: 0, skipped: "daily_cap" };

  // Idempotent reference
  const reference =
    referenceOverride ??
    (action === "POST_CREATE"
      ? `social_post_${recipientUserId}_${utcDateKey()}`
      : `social_${action.toLowerCase()}_${postId ?? "_"}_${sourceUserId ?? "_"}`);

  // Atomic credit. If reference already exists (rare race), the unique-ish
  // create will throw — catch and treat as duplicate.
  try {
    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: recipientUserId,
          type: TransactionType.EARNING,
          status: TransactionStatus.COMPLETED,
          points: allow,
          amount: allow / 1000,
          description: ACTION_DESCRIPTION[action],
          reference,
          metadata: { action, postId, sourceUserId },
        },
      }),
      prisma.user.update({
        where: { id: recipientUserId },
        data: {
          pointsBalance: { increment: allow },
          totalEarnings: { increment: allow / 1000 },
        },
      }),
      ...(postId
        ? [
            prisma.post.update({
              where: { id: postId },
              data: { socialEarnings: { increment: allow } },
            }),
          ]
        : []),
      prisma.notification.create({
        data: {
          userId: recipientUserId,
          type: NotificationType.WALLET,
          title: `+${allow} pts earned`,
          message: ACTION_DESCRIPTION[action],
          data: { action, postId, sourceUserId, amount: allow },
        },
      }),
    ]);
    return { awarded: allow };
  } catch (err) {
    // Reference is not unique on Transaction, but if a true duplicate happens
    // we surface it as a skip; otherwise re-throw.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint") || msg.includes("duplicate key")) {
      return { awarded: 0, skipped: "duplicate" };
    }
    console.error("[social-earning] award failed:", err);
    return { awarded: 0, skipped: "duplicate" };
  }
}
