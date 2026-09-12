/**
 * Social-earning vocabulary and config parsing — the single source of truth.
 *
 * **Prisma-free and `server-only`-free on purpose**: the admin form is a client
 * component and imports from here. Adding a server import to this file breaks
 * the build in a confusing way.
 *
 * This list used to be copy-pasted into four files (the engine, the API route,
 * the server page and the client form), and their fallbacks had already drifted
 * apart — the API's GET defaulted every payout to 0 points while the engine
 * defaulted them to 1-5. Everything now reads from here.
 */

export const SOCIAL_ACTIONS = [
  "POST_CREATE",
  "VIEW_RECEIVED",
  "LIKE_RECEIVED",
  "VOTE_RECEIVED",
  "COMMENT_RECEIVED",
  "SHARE_RECEIVED",
  "DONATION_RECEIVED",
  "MENTION_RECEIVED",
] as const;

export type SocialAction = (typeof SOCIAL_ACTIONS)[number];

/** The lowercase form used as the SystemSetting key prefix and the UI key. */
export const SOCIAL_ACTIVITY_KEYS = [
  "post_create",
  "view_received",
  "like_received",
  "vote_received",
  "comment_received",
  "share_received",
  "donation_received",
  "mention_received",
] as const;

export type SocialActivityKey = (typeof SOCIAL_ACTIVITY_KEYS)[number];

/** Over what period a ratio counts before it resets. */
export type RatioWindow = "daily" | "lifetime";

export const RATIO_WINDOWS: RatioWindow[] = ["daily", "lifetime"];

export interface PerSideRule {
  enabled: boolean;
  points: number;
  xp: number;
  /**
   * Award `points`+`xp` once per this many counted actions. 1 = flat, paid on
   * every action (the original behaviour). e.g. 100 → one payout per 100 likes.
   */
  perCount: number;
  /** `daily` resets at the PAID user's local midnight; `lifetime` never resets. */
  window: RatioWindow;
}

export interface SocialEarningConfig {
  enabled: boolean;
  /**
   * Mode 1 — "the poster earns": the author is paid for the likes / comments /
   * shares their post receives (`role === "recipient"`).
   *
   * Ships OFF. Every per-activity recipient rate below is inert until the owner
   * turns this on, because he has not chosen his numbers yet.
   */
  posterModeEnabled: boolean;
  /**
   * Mode 2 — "the engager earns": the liker / commenter / sharer is paid for
   * performing the action (`role === "actor"`).
   *
   * Ships OFF, same reason.
   */
  engagerModeEnabled: boolean;
  perActivity: Record<
    SocialAction,
    { recipient: PerSideRule; actor: PerSideRule }
  >;
  dailyCapPerUser: number;
  /**
   * Per-user daily ceiling on POSTER-mode points alone. The platform-wide
   * `dailyCapPerUser` still applies on top; the tighter of the two wins, so
   * raising one can never widen the other.
   */
  posterDailyCapPerUser: number;
  /** Per-user daily ceiling on ENGAGER-mode points alone. Same stacking rule. */
  engagerDailyCapPerUser: number;
  /**
   * Most points one user may earn in a day **from any one other account**,
   * per mode.
   *
   * This is the defence against the attack the self-guard cannot see: two (or
   * fifty) accounts that like, comment on and share each other's posts all day.
   * Neither is earning from itself, so `skipped: "self"` never fires — but
   * every payout on both sides carries `metadata.sourceUserId`, and once a pair
   * has moved this many points between them today, the pair is done. A ring of
   * N accounts therefore costs an attacker N real accounts to earn N × this,
   * instead of two accounts earning the full daily cap.
   *
   * 0 disables the pair cap (it does NOT mean "pay nothing") — deliberately the
   * opposite polarity to `dailyCapPerUser`, because a pair cap is a filter and
   * a daily cap is a budget.
   */
  pairDailyCapPerUser: number;
  /**
   * Account level (from `calculateLevel(xp)`) required before either mode pays.
   * 0 = no gate. Stacks with `minAccountAgeHours`: a farm has to both age and
   * level its throwaway accounts.
   */
  minLevelToEarn: number;
  dailyXpCapPerUser: number;
  capPerPost: number;
  minAccountAgeHours: number;
  countTowardDailyMissions: boolean;
  missionDistinctPost: boolean;
}

/**
 * What one "count" means for a ratio.
 *
 * `distinct_post` is the anti-farming unit: repeating an action on the SAME post
 * counts once, so like → unlike → like can't drive a counter. `event` is for
 * actions where a repeat is genuinely new.
 *
 * `MENTION_RECEIVED` must be `event`: one post that @-mentions five people fires
 * five awards sharing one postId, so distinct-post would collapse them to one
 * and only the first-resolved mentionee would ever count.
 */
export const RATIO_UNIT: Record<SocialAction, "distinct_post" | "event"> = {
  POST_CREATE: "event", // every post is a new postId anyway
  VIEW_RECEIVED: "distinct_post",
  LIKE_RECEIVED: "distinct_post",
  VOTE_RECEIVED: "distinct_post",
  COMMENT_RECEIVED: "distinct_post",
  SHARE_RECEIVED: "distinct_post",
  DONATION_RECEIVED: "event", // a second donation is a real second donation
  MENTION_RECEIVED: "event",
};

const flat = (
  enabled: boolean,
  points: number,
  window: RatioWindow = "lifetime"
): PerSideRule => ({ enabled, points, xp: 0, perCount: 1, window });

export const SOCIAL_EARNING_DEFAULTS: SocialEarningConfig = {
  enabled: true,
  perActivity: {
    // Recipient windows default to `daily`, actor to `lifetime` — the actor
    // default preserves exactly how the shipped ratio already behaved.
    POST_CREATE: { recipient: flat(true, 5), actor: flat(false, 0) },
    VIEW_RECEIVED: {
      recipient: flat(true, 0, "daily"),
      actor: flat(false, 0),
    },
    LIKE_RECEIVED: {
      recipient: flat(true, 1, "daily"),
      actor: flat(false, 0),
    },
    VOTE_RECEIVED: {
      recipient: flat(true, 1, "daily"),
      actor: flat(false, 0),
    },
    COMMENT_RECEIVED: {
      recipient: flat(true, 2, "daily"),
      actor: flat(false, 0),
    },
    SHARE_RECEIVED: {
      recipient: flat(true, 3, "daily"),
      actor: flat(false, 0),
    },
    DONATION_RECEIVED: {
      recipient: flat(false, 0, "daily"),
      actor: flat(false, 0),
    },
    MENTION_RECEIVED: {
      recipient: flat(true, 1, "daily"),
      actor: flat(false, 0),
    },
  },
  // Both earning modes ship OFF. The per-activity rates above are the shape of
  // the offer, not the offer itself — nothing pays until the owner flips the
  // two mode switches on the settings page, having picked his own numbers.
  // ON, unlike every other new switch here, because these two are not a new
  // feature — they are a master gate placed OVER behaviour that is already
  // live. There is not one `social_earning.*` row in the database, so the whole
  // system runs on these defaults, and 53 payments have already been made under
  // them. Shipping the gates closed would silently stop feed earning for
  // everyone currently receiving it, which is not a default, it is an outage.
  // What actually decides whether anything pays is still the per-action enable
  // beneath each mode.
  posterModeEnabled: true,
  engagerModeEnabled: true,
  dailyCapPerUser: 500,
  // Conservative on purpose. These are the numbers a bot farm runs into on the
  // night the owner turns a mode on and before he has tuned anything.
  posterDailyCapPerUser: 200,
  engagerDailyCapPerUser: 100,
  pairDailyCapPerUser: 25,
  minLevelToEarn: 0,
  dailyXpCapPerUser: 1000,
  capPerPost: 100,
  minAccountAgeHours: 24,
  countTowardDailyMissions: true,
  missionDistinctPost: true,
};

export const SOCIAL_EARNING_CATEGORY = "social_earning";

// ─── Coercion helpers (SystemSetting values are JSON and can round-trip as
//     strings, so never trust the stored type) ──────────────────────────────

export function asNumber(v: unknown, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function asBoolean(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return fallback;
}

export function asWindow(v: unknown, fallback: RatioWindow): RatioWindow {
  return v === "daily" || v === "lifetime" ? v : fallback;
}

function perCountOf(v: unknown, fallback: number): number {
  return Math.max(1, Math.floor(asNumber(v, fallback)));
}

/**
 * Build the runtime config from raw `SystemSetting` rows.
 *
 * Pure so it can be unit-tested without a database — the engine imports
 * `server-only` transitively, so this is the only part that a plain script can
 * exercise.
 *
 * Note the deliberately asymmetric key names: the recipient side predates the
 * actor side and uses `{k}_enabled` / `{k}_points` with no `_recipient_` infix.
 * Renaming them would orphan every saved row, so they stay.
 */
export function parseSocialEarningConfig(
  map: Map<string, unknown>
): SocialEarningConfig {
  const d = SOCIAL_EARNING_DEFAULTS;
  const get = (k: string) => map.get(`${SOCIAL_EARNING_CATEGORY}.${k}`);

  const perActivity = {} as SocialEarningConfig["perActivity"];
  for (const action of SOCIAL_ACTIONS) {
    const k = action.toLowerCase();
    const dr = d.perActivity[action].recipient;
    const da = d.perActivity[action].actor;
    perActivity[action] = {
      recipient: {
        enabled: asBoolean(get(`${k}_enabled`), dr.enabled),
        points: asNumber(get(`${k}_points`), dr.points),
        xp: asNumber(get(`${k}_recipient_xp`), dr.xp),
        perCount: perCountOf(get(`${k}_recipient_per_count`), dr.perCount),
        window: asWindow(get(`${k}_recipient_per_window`), dr.window),
      },
      actor: {
        enabled: asBoolean(get(`${k}_actor_enabled`), da.enabled),
        points: asNumber(get(`${k}_actor_points`), da.points),
        xp: asNumber(get(`${k}_actor_xp`), da.xp),
        perCount: perCountOf(get(`${k}_actor_per_count`), da.perCount),
        window: asWindow(get(`${k}_actor_per_window`), da.window),
      },
    };
  }

  return {
    enabled: asBoolean(get("enabled"), d.enabled),
    posterModeEnabled: asBoolean(
      get("poster_mode_enabled"),
      d.posterModeEnabled
    ),
    engagerModeEnabled: asBoolean(
      get("engager_mode_enabled"),
      d.engagerModeEnabled
    ),
    perActivity,
    dailyCapPerUser: asNumber(get("daily_cap_per_user"), d.dailyCapPerUser),
    posterDailyCapPerUser: asNumber(
      get("poster_daily_cap_per_user"),
      d.posterDailyCapPerUser
    ),
    engagerDailyCapPerUser: asNumber(
      get("engager_daily_cap_per_user"),
      d.engagerDailyCapPerUser
    ),
    pairDailyCapPerUser: asNumber(
      get("pair_daily_cap_per_user"),
      d.pairDailyCapPerUser
    ),
    minLevelToEarn: asNumber(get("min_level_to_earn"), d.minLevelToEarn),
    dailyXpCapPerUser: asNumber(
      get("daily_xp_cap_per_user"),
      d.dailyXpCapPerUser
    ),
    capPerPost: asNumber(get("cap_per_post"), d.capPerPost),
    minAccountAgeHours: asNumber(
      get("min_account_age_hours"),
      d.minAccountAgeHours
    ),
    countTowardDailyMissions: asBoolean(
      get("count_toward_daily_missions"),
      d.countTowardDailyMissions
    ),
    missionDistinctPost: asBoolean(
      get("mission_distinct_post"),
      d.missionDistinctPost
    ),
  };
}

// ─── Admin copy ─────────────────────────────────────────────────────────────

interface ActivityCopy {
  /** What the ACTOR does, e.g. "like a post". */
  actorVerb: string;
  /** What the RECIPIENT receives, e.g. "likes". */
  recipientNoun: string;
}

const COPY: Record<SocialActivityKey, ActivityCopy> = {
  post_create: { actorVerb: "publish a post", recipientNoun: "posts published" },
  view_received: { actorVerb: "view a post", recipientNoun: "views" },
  like_received: { actorVerb: "like a post", recipientNoun: "likes" },
  vote_received: { actorVerb: "vote in a poll", recipientNoun: "votes" },
  comment_received: { actorVerb: "comment on a post", recipientNoun: "comments" },
  share_received: { actorVerb: "share a post", recipientNoun: "shares" },
  donation_received: { actorVerb: "donate to a post", recipientNoun: "donations" },
  mention_received: { actorVerb: "@mention someone", recipientNoun: "@mentions" },
};

/**
 * A plain-English sentence describing what a side's settings will actually do.
 * The admin form shows this under each side — without it, "Per 100 / daily /
 * 10 pts" is easy to read three different ways.
 */
export function ratioPreview(
  key: SocialActivityKey,
  side: "recipient" | "actor",
  rule: Pick<PerSideRule, "perCount" | "window" | "points" | "xp" | "enabled">
): string {
  if (!rule.enabled) return "Off — nothing is awarded.";
  const reward = [
    rule.points > 0 ? `+${rule.points} ${rule.points === 1 ? "pt" : "pts"}` : null,
    rule.xp > 0 ? `+${rule.xp} XP` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  if (!reward) return "Enabled, but both points and XP are 0 — nothing is awarded.";

  const c = COPY[key];
  // `SOCIAL_ACTIONS` and `SOCIAL_ACTIVITY_KEYS` are parallel by convention only
  // — TypeScript enforces neither the same length nor the same order — and this
  // is the one place that relies on the alignment. Reordering or inserting into
  // either tuple without the other silently mislabels the ratio unit here (and
  // nothing else, because every other mapping goes through `toLowerCase()`),
  // which is the hardest kind of failure to notice. Change display order in the
  // admin form's own array instead.
  const action = SOCIAL_ACTIONS[SOCIAL_ACTIVITY_KEYS.indexOf(key)];
  const distinct = RATIO_UNIT[action] === "distinct_post";

  if (rule.perCount <= 1) {
    return side === "recipient"
      ? `Each of the ${c.recipientNoun} your post receives → ${reward}.`
      : `Every time you ${c.actorVerb} → ${reward}.`;
  }

  const when = rule.window === "daily" ? "in one day" : "in total (all time)";
  const note = distinct
    ? side === "recipient"
      ? " Counted once per post per person."
      : " Counted once per post."
    : "";

  return side === "recipient"
    ? `Your posts receive ${rule.perCount} ${c.recipientNoun} ${when} (across all your posts) → ${reward}.${note}`
    : `You ${c.actorVerb} ${rule.perCount} times ${when} → ${reward}.${note}`;
}
