/**
 * Social engagement earning helper.
 *
 * Awards points + XP to BOTH sides of an engagement:
 *   - The "recipient" (the post author who received the engagement).
 *   - The "actor" (the user who performed the action — liker / commenter / sharer / voter).
 *
 * Each side has its own admin-tunable enable, points, and xp setting per action.
 * Defaults keep the actor side OFF so day-one behaviour matches the legacy
 * recipient-only system.
 *
 * Idempotency: every credit writes a Transaction with a deterministic
 * `reference` that includes a `_recipient_` or `_actor_` segment so the two
 * sides cannot collide. POST_CREATE keeps its date-keyed once-per-day reference.
 */
import { prisma } from "@/lib/prisma";
import {
  Prisma,
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

export type SkipReason =
  | "disabled"
  | "self"
  | "min_age"
  | "banned"
  | "post_cap"
  | "daily_cap"
  | "daily_xp_cap"
  | "duplicate"
  | "no_recipient";

export interface AwardArgs {
  postOwnerUserId: string | null;
  actorUserId: string | null;
  action: SocialAction;
  postId?: string | null;
  referenceOverride?: string;
}

export interface SideResult {
  points: number;
  xp: number;
  skipped?: SkipReason;
}

export interface AwardResult {
  recipient: SideResult;
  actor: SideResult;
}

interface PerSideRule {
  enabled: boolean;
  points: number;
  xp: number;
}

interface SocialEarningConfig {
  enabled: boolean;
  perActivity: Record<
    SocialAction,
    { recipient: PerSideRule; actor: PerSideRule }
  >;
  dailyCapPerUser: number;
  dailyXpCapPerUser: number;
  capPerPost: number;
  minAccountAgeHours: number;
  countTowardDailyMissions: boolean;
  missionDistinctPost: boolean;
}

const DEFAULTS: SocialEarningConfig = {
  enabled: true,
  perActivity: {
    POST_CREATE: {
      recipient: { enabled: true, points: 5, xp: 0 },
      actor: { enabled: false, points: 0, xp: 0 },
    },
    VIEW_RECEIVED: {
      recipient: { enabled: true, points: 0, xp: 0 },
      actor: { enabled: false, points: 0, xp: 0 },
    },
    LIKE_RECEIVED: {
      recipient: { enabled: true, points: 1, xp: 0 },
      actor: { enabled: false, points: 0, xp: 0 },
    },
    VOTE_RECEIVED: {
      recipient: { enabled: true, points: 1, xp: 0 },
      actor: { enabled: false, points: 0, xp: 0 },
    },
    COMMENT_RECEIVED: {
      recipient: { enabled: true, points: 2, xp: 0 },
      actor: { enabled: false, points: 0, xp: 0 },
    },
    SHARE_RECEIVED: {
      recipient: { enabled: true, points: 3, xp: 0 },
      actor: { enabled: false, points: 0, xp: 0 },
    },
    DONATION_RECEIVED: {
      recipient: { enabled: false, points: 0, xp: 0 },
      actor: { enabled: false, points: 0, xp: 0 },
    },
    MENTION_RECEIVED: {
      recipient: { enabled: true, points: 1, xp: 0 },
      actor: { enabled: false, points: 0, xp: 0 },
    },
  },
  dailyCapPerUser: 500,
  dailyXpCapPerUser: 1000,
  capPerPost: 100,
  minAccountAgeHours: 24,
  countTowardDailyMissions: true,
  missionDistinctPost: true,
};

const CATEGORY = "social_earning";

const ACTOR_LOG_ACTION: Partial<Record<SocialAction, string>> = {
  POST_CREATE: "POST_CREATED",
  LIKE_RECEIVED: "LIKE_GIVEN",
  COMMENT_RECEIVED: "COMMENT_GIVEN",
  VOTE_RECEIVED: "VOTE_GIVEN",
  SHARE_RECEIVED: "SHARE_GIVEN",
};

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
    dailyXpCapPerUser: asNumber(
      map.get("social_earning.daily_xp_cap_per_user"),
      DEFAULTS.dailyXpCapPerUser
    ),
    capPerPost: asNumber(
      map.get("social_earning.cap_per_post"),
      DEFAULTS.capPerPost
    ),
    minAccountAgeHours: asNumber(
      map.get("social_earning.min_account_age_hours"),
      DEFAULTS.minAccountAgeHours
    ),
    countTowardDailyMissions: asBoolean(
      map.get("social_earning.count_toward_daily_missions"),
      DEFAULTS.countTowardDailyMissions
    ),
    missionDistinctPost: asBoolean(
      map.get("social_earning.mission_distinct_post"),
      DEFAULTS.missionDistinctPost
    ),
  };
  for (const action of Object.keys(DEFAULTS.perActivity) as SocialAction[]) {
    const k = action.toLowerCase();
    const def = DEFAULTS.perActivity[action];
    cfg.perActivity[action] = {
      recipient: {
        enabled: asBoolean(
          map.get(`social_earning.${k}_enabled`),
          def.recipient.enabled
        ),
        points: asNumber(
          map.get(`social_earning.${k}_points`),
          def.recipient.points
        ),
        xp: asNumber(
          map.get(`social_earning.${k}_recipient_xp`),
          def.recipient.xp
        ),
      },
      actor: {
        enabled: asBoolean(
          map.get(`social_earning.${k}_actor_enabled`),
          def.actor.enabled
        ),
        points: asNumber(
          map.get(`social_earning.${k}_actor_points`),
          def.actor.points
        ),
        xp: asNumber(
          map.get(`social_earning.${k}_actor_xp`),
          def.actor.xp
        ),
      },
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

const ACTION_DESCRIPTION_RECIPIENT: Record<SocialAction, string> = {
  POST_CREATE: "Created a post",
  VIEW_RECEIVED: "Earned from a view on your post",
  LIKE_RECEIVED: "Earned from a like on your post",
  VOTE_RECEIVED: "Earned from a vote on your poll",
  COMMENT_RECEIVED: "Earned from a comment on your post",
  SHARE_RECEIVED: "Earned from a share of your post",
  DONATION_RECEIVED: "Earned from a donation",
  MENTION_RECEIVED: "Mentioned in a post / comment",
};

const ACTION_DESCRIPTION_ACTOR: Record<SocialAction, string> = {
  POST_CREATE: "Created a post",
  VIEW_RECEIVED: "Viewed a post",
  LIKE_RECEIVED: "Liked a post",
  VOTE_RECEIVED: "Voted on a poll",
  COMMENT_RECEIVED: "Commented on a post",
  SHARE_RECEIVED: "Shared a post",
  DONATION_RECEIVED: "Made a donation",
  MENTION_RECEIVED: "Mentioned someone",
};

interface CreditCtx {
  userId: string;
  role: "recipient" | "actor";
  rule: PerSideRule;
  cfg: SocialEarningConfig;
  action: SocialAction;
  postId: string | null | undefined;
  sourceUserId: string | null | undefined;
  referenceOverride?: string;
}

async function creditOne(ctx: CreditCtx): Promise<SideResult> {
  const { userId, role, rule, cfg, action, postId, sourceUserId } = ctx;

  if (!rule.enabled || (rule.points <= 0 && rule.xp <= 0)) {
    return { points: 0, xp: 0, skipped: "disabled" };
  }

  // User must be ACTIVE and old enough
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, createdAt: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return { points: 0, xp: 0, skipped: "banned" };
  }
  const ageHours =
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < cfg.minAccountAgeHours) {
    return { points: 0, xp: 0, skipped: "min_age" };
  }

  // Per-post cap (only counted against recipient credits — the post is what fills up)
  let postEarned = 0;
  if (postId && role === "recipient") {
    const p = await prisma.post.findUnique({
      where: { id: postId },
      select: { socialEarnings: true },
    });
    if (!p) return { points: 0, xp: 0, skipped: "no_recipient" };
    postEarned = p.socialEarnings;
    if (postEarned >= cfg.capPerPost) {
      return { points: 0, xp: 0, skipped: "post_cap" };
    }
  }

  const todayStart = utcStartOfDay();

  // Daily points cap
  const dailyPts = await prisma.transaction.aggregate({
    where: {
      userId,
      reference: { startsWith: "social_" },
      createdAt: { gte: todayStart },
    },
    _sum: { points: true },
  });
  const todayPoints = Math.max(0, dailyPts._sum.points ?? 0);

  // Daily XP cap (sum metadata.xp on today's social_* rows)
  let todayXp = 0;
  if (cfg.dailyXpCapPerUser > 0) {
    const todayRows = await prisma.transaction.findMany({
      where: {
        userId,
        reference: { startsWith: "social_" },
        createdAt: { gte: todayStart },
      },
      select: { metadata: true },
    });
    for (const r of todayRows) {
      const md = r.metadata as { xp?: number } | null;
      if (md && typeof md.xp === "number") todayXp += md.xp;
    }
  }

  // Cap points
  let allowPoints = Math.max(0, Math.floor(rule.points));
  if (allowPoints > 0) {
    if (postId && role === "recipient") {
      allowPoints = Math.min(allowPoints, cfg.capPerPost - postEarned);
    }
    allowPoints = Math.min(allowPoints, Math.max(0, cfg.dailyCapPerUser - todayPoints));
  }
  if (allowPoints > 0 && cfg.dailyCapPerUser > 0 && todayPoints >= cfg.dailyCapPerUser) {
    allowPoints = 0;
  }

  // Cap xp
  let allowXp = Math.max(0, Math.floor(rule.xp));
  if (allowXp > 0 && cfg.dailyXpCapPerUser > 0) {
    allowXp = Math.min(allowXp, Math.max(0, cfg.dailyXpCapPerUser - todayXp));
  }

  if (allowPoints <= 0 && allowXp <= 0) {
    if (cfg.dailyCapPerUser > 0 && todayPoints >= cfg.dailyCapPerUser) {
      return { points: 0, xp: 0, skipped: "daily_cap" };
    }
    if (cfg.dailyXpCapPerUser > 0 && todayXp >= cfg.dailyXpCapPerUser) {
      return { points: 0, xp: 0, skipped: "daily_xp_cap" };
    }
    return { points: 0, xp: 0, skipped: "disabled" };
  }

  // Idempotent reference
  const reference =
    ctx.referenceOverride ??
    (action === "POST_CREATE"
      ? `social_post_${role}_${userId}_${utcDateKey()}`
      : `social_${action.toLowerCase()}_${role}_${postId ?? "_"}_${sourceUserId ?? "_"}`);

  // Pre-flight duplicate check (the reference field is not unique on Transaction
  // but we treat it as logically unique for idempotency).
  const dup = await prisma.transaction.findFirst({
    where: { reference },
    select: { id: true },
  });
  if (dup) return { points: 0, xp: 0, skipped: "duplicate" };

  const description =
    role === "recipient"
      ? ACTION_DESCRIPTION_RECIPIENT[action]
      : ACTION_DESCRIPTION_ACTOR[action];

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  ops.push(
    prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.EARNING,
        status: TransactionStatus.COMPLETED,
        points: allowPoints,
        amount: allowPoints / 1000,
        description,
        reference,
        metadata: {
          action,
          role,
          postId: postId ?? null,
          sourceUserId: sourceUserId ?? null,
          xp: allowXp,
        },
      },
    })
  );

  ops.push(
    prisma.user.update({
      where: { id: userId },
      data: {
        pointsBalance: { increment: allowPoints },
        totalEarnings: { increment: allowPoints / 1000 },
        xp: { increment: allowXp },
      },
    })
  );

  if (postId && role === "recipient" && allowPoints > 0) {
    ops.push(
      prisma.post.update({
        where: { id: postId },
        data: { socialEarnings: { increment: allowPoints } },
      })
    );
  }

  if (allowPoints > 0 || allowXp > 0) {
    const parts: string[] = [];
    if (allowPoints > 0) parts.push(`+${allowPoints} pts`);
    if (allowXp > 0) parts.push(`+${allowXp} XP`);
    ops.push(
      prisma.notification.create({
        data: {
          userId,
          type: NotificationType.WALLET,
          title: parts.join(" · "),
          message: description,
          data: {
            action,
            role,
            postId: postId ?? null,
            sourceUserId: sourceUserId ?? null,
            points: allowPoints,
            xp: allowXp,
          },
        },
      })
    );
  }

  // Actor-side: log to SocialActionLog so daily missions can count it
  if (role === "actor" && cfg.countTowardDailyMissions) {
    const logAction = ACTOR_LOG_ACTION[action];
    if (logAction) {
      ops.push(
        prisma.socialActionLog.create({
          data: {
            userId,
            action: logAction,
            postId: postId ?? null,
            dateKey: utcDateKey(),
          },
        })
      );
    }
  }

  try {
    await prisma.$transaction(ops);
    return { points: allowPoints, xp: allowXp };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint") || msg.includes("duplicate key")) {
      return { points: 0, xp: 0, skipped: "duplicate" };
    }
    console.error("[social-earning] credit failed:", err);
    return { points: 0, xp: 0, skipped: "duplicate" };
  }
}

/**
 * Award social engagement rewards. Handles both recipient (post owner) and
 * actor (engaging user) credits. Safe to call from anywhere; never throws on
 * business-rule misses, only on infra errors.
 *
 * For POST_CREATE the post owner IS the actor — actor side is short-circuited
 * as `self` to avoid double-credit; the recipient credit is the only payout.
 */
export async function awardSocialEarning(
  args: AwardArgs
): Promise<AwardResult> {
  const { postOwnerUserId, actorUserId, action, postId, referenceOverride } = args;

  const result: AwardResult = {
    recipient: { points: 0, xp: 0, skipped: "no_recipient" },
    actor: { points: 0, xp: 0, skipped: "no_recipient" },
  };

  const cfg = await getSocialEarningConfig();
  if (!cfg.enabled) {
    return {
      recipient: { points: 0, xp: 0, skipped: "disabled" },
      actor: { points: 0, xp: 0, skipped: "disabled" },
    };
  }

  // Recipient credit
  if (postOwnerUserId) {
    if (actorUserId && actorUserId === postOwnerUserId && action !== "POST_CREATE") {
      result.recipient = { points: 0, xp: 0, skipped: "self" };
    } else {
      result.recipient = await creditOne({
        userId: postOwnerUserId,
        role: "recipient",
        rule: cfg.perActivity[action].recipient,
        cfg,
        action,
        postId,
        sourceUserId: actorUserId,
        referenceOverride,
      });
    }
  }

  // Actor credit — skipped when actor === recipient (e.g. POST_CREATE is one-sided)
  if (actorUserId) {
    if (postOwnerUserId && actorUserId === postOwnerUserId) {
      result.actor = { points: 0, xp: 0, skipped: "self" };
    } else {
      result.actor = await creditOne({
        userId: actorUserId,
        role: "actor",
        rule: cfg.perActivity[action].actor,
        cfg,
        action,
        postId,
        sourceUserId: postOwnerUserId,
      });
    }
  }

  return result;
}
