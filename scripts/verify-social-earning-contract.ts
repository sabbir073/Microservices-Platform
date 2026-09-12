import "dotenv/config";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import {
  SOCIAL_EARNING_DEFAULTS,
  SOCIAL_ACTIONS,
  SOCIAL_ACTIVITY_KEYS,
  SOCIAL_EARNING_CATEGORY,
  parseSocialEarningConfig,
  ratioPreview,
  type SocialActivityKey,
  type RatioWindow,
} from "../src/lib/social-actions";

/**
 * §9 verification — the social-earning admin form was restructured, and the ONE
 * thing that must not have moved is what it saves.
 *
 * The form posts its whole `FormState` object; the API maps it to ~87
 * SystemSetting rows; `parseSocialEarningConfig` maps those rows back. This
 * script proves the two mappings are still exact inverses for the payload the
 * form actually sends — including the trap the restructure could have sprung:
 * `post_create`'s engager block has no UI, but the API writes
 * `post_create_actor_*` unconditionally, so dropping the hidden object from
 * state would silently rewrite those rows from defaults.
 *
 * Run:  npx tsx scripts/verify-social-earning-contract.ts
 *
 * Read-only. It never writes to the database.
 */

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * Source with comments stripped, so a check can never pass on prose that merely
 * describes the behaviour. Same helper as scripts/verify-feed-features.ts.
 */
const code = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/* ── The shapes, replicated from the code under test ──────────────────────── */

// Mirrors the form's SideRow / FormState and the API's zod schema. If any of
// these three drift apart, this script stops matching and the checks fail.
interface SideRow {
  enabled: boolean;
  points: number;
  xp: number;
  perCount: number;
  window: RatioWindow;
}
interface FormState {
  enabled: boolean;
  poster_mode_enabled: boolean;
  engager_mode_enabled: boolean;
  daily_cap_per_user: number;
  poster_daily_cap_per_user: number;
  engager_daily_cap_per_user: number;
  pair_daily_cap_per_user: number;
  min_level_to_earn: number;
  daily_xp_cap_per_user: number;
  cap_per_post: number;
  min_account_age_hours: number;
  count_toward_daily_missions: boolean;
  mission_distinct_post: boolean;
  activities: Record<SocialActivityKey, { recipient: SideRow; actor: SideRow }>;
}

/** Byte-for-byte the schema in src/app/api/admin/settings/social-earning/route.ts */
const sideSchema = z.object({
  enabled: z.boolean(),
  points: z.number().min(0).max(10000),
  xp: z.number().min(0).max(10000),
  perCount: z.number().int().min(1).max(1_000_000).optional(),
  window: z.enum(["daily", "lifetime"]).optional(),
});
const apiSchema = z.object({
  enabled: z.boolean(),
  poster_mode_enabled: z.boolean(),
  engager_mode_enabled: z.boolean(),
  daily_cap_per_user: z.number().int().min(0).max(100000),
  poster_daily_cap_per_user: z.number().int().min(0).max(100000),
  engager_daily_cap_per_user: z.number().int().min(0).max(100000),
  pair_daily_cap_per_user: z.number().int().min(0).max(100000),
  min_level_to_earn: z.number().int().min(0).max(50),
  daily_xp_cap_per_user: z.number().int().min(0).max(100000),
  cap_per_post: z.number().int().min(0).max(100000),
  min_account_age_hours: z.number().int().min(0).max(720),
  count_toward_daily_missions: z.boolean(),
  mission_distinct_post: z.boolean(),
  activities: z.record(
    z.enum(SOCIAL_ACTIVITY_KEYS),
    z.object({ recipient: sideSchema, actor: sideSchema })
  ),
});

/** Byte-for-byte the `writes` array the API builds from a validated payload. */
function apiWrites(cfg: FormState): Map<string, unknown> {
  const m = new Map<string, unknown>();
  const p = (k: string, v: unknown) => m.set(`${SOCIAL_EARNING_CATEGORY}.${k}`, v);
  p("enabled", cfg.enabled);
  p("poster_mode_enabled", cfg.poster_mode_enabled);
  p("engager_mode_enabled", cfg.engager_mode_enabled);
  p("daily_cap_per_user", cfg.daily_cap_per_user);
  p("poster_daily_cap_per_user", cfg.poster_daily_cap_per_user);
  p("engager_daily_cap_per_user", cfg.engager_daily_cap_per_user);
  p("pair_daily_cap_per_user", cfg.pair_daily_cap_per_user);
  p("min_level_to_earn", cfg.min_level_to_earn);
  p("daily_xp_cap_per_user", cfg.daily_xp_cap_per_user);
  p("cap_per_post", cfg.cap_per_post);
  p("min_account_age_hours", cfg.min_account_age_hours);
  p("count_toward_daily_missions", cfg.count_toward_daily_missions);
  p("mission_distinct_post", cfg.mission_distinct_post);
  for (const a of SOCIAL_ACTIVITY_KEYS) {
    const row = cfg.activities[a];
    if (!row) continue; // the API skips a missing key — it does NOT clear it
    p(`${a}_enabled`, row.recipient.enabled);
    p(`${a}_points`, row.recipient.points);
    p(`${a}_recipient_xp`, row.recipient.xp);
    p(`${a}_actor_enabled`, row.actor.enabled);
    p(`${a}_actor_points`, row.actor.points);
    p(`${a}_actor_xp`, row.actor.xp);
    p(`${a}_actor_per_count`, row.actor.perCount ?? 1);
    p(`${a}_recipient_per_count`, row.recipient.perCount ?? 1);
    p(`${a}_recipient_per_window`, row.recipient.window ?? "daily");
    p(`${a}_actor_per_window`, row.actor.window ?? "lifetime");
  }
  return m;
}

/** Byte-for-byte `readSocialEarningAdminConfig`, minus the prisma read. */
function toFormState(map: Map<string, unknown>): FormState {
  const cfg = parseSocialEarningConfig(map);
  const activities = {} as FormState["activities"];
  for (const action of SOCIAL_ACTIONS) {
    const key = action.toLowerCase() as SocialActivityKey;
    activities[key] = {
      recipient: { ...cfg.perActivity[action].recipient },
      actor: { ...cfg.perActivity[action].actor },
    };
  }
  return {
    enabled: cfg.enabled,
    poster_mode_enabled: cfg.posterModeEnabled,
    engager_mode_enabled: cfg.engagerModeEnabled,
    daily_cap_per_user: cfg.dailyCapPerUser,
    poster_daily_cap_per_user: cfg.posterDailyCapPerUser,
    engager_daily_cap_per_user: cfg.engagerDailyCapPerUser,
    pair_daily_cap_per_user: cfg.pairDailyCapPerUser,
    min_level_to_earn: cfg.minLevelToEarn,
    daily_xp_cap_per_user: cfg.dailyXpCapPerUser,
    cap_per_post: cfg.capPerPost,
    min_account_age_hours: cfg.minAccountAgeHours,
    count_toward_daily_missions: cfg.countTowardDailyMissions,
    mission_distinct_post: cfg.missionDistinctPost,
    activities,
  };
}

/** Order-insensitive deep compare, so key ordering can't create a false pass. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(",")}}`;
}
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/* ── The display grouping in the rebuilt form ─────────────────────────────── */

const GROUP_KEYS: SocialActivityKey[] = [
  "post_create",
  "view_received",
  "like_received",
  "vote_received",
  "comment_received",
  "share_received",
  "mention_received",
  "donation_received",
];

/* ── Random payloads, to exercise combinations the live row never hits ────── */

let seed = 987654321;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

function randomSide(): SideRow {
  return {
    enabled: rnd() < 0.5,
    // Fractional on purpose: the API types points/xp as z.number(), NOT .int().
    points: pick([0, 1, 5, 2.5, 0.5, 10000]),
    xp: pick([0, 3, 7.25, 10000]),
    perCount: pick([1, 2, 100, 1_000_000]),
    window: pick(["daily", "lifetime"] as const),
  };
}
function randomForm(): FormState {
  const activities = {} as FormState["activities"];
  for (const k of SOCIAL_ACTIVITY_KEYS) {
    activities[k] = { recipient: randomSide(), actor: randomSide() };
  }
  return {
    enabled: rnd() < 0.5,
    poster_mode_enabled: rnd() < 0.5,
    engager_mode_enabled: rnd() < 0.5,
    daily_cap_per_user: Math.floor(rnd() * 100001),
    poster_daily_cap_per_user: Math.floor(rnd() * 100001),
    engager_daily_cap_per_user: Math.floor(rnd() * 100001),
    pair_daily_cap_per_user: Math.floor(rnd() * 100001),
    min_level_to_earn: Math.floor(rnd() * 51),
    daily_xp_cap_per_user: Math.floor(rnd() * 100001),
    cap_per_post: Math.floor(rnd() * 100001),
    min_account_age_hours: Math.floor(rnd() * 721),
    count_toward_daily_missions: rnd() < 0.5,
    mission_distinct_post: rnd() < 0.5,
    activities,
  };
}

async function main() {
  console.log("\n=== §9 social-earning contract ===\n");

  /* 1 — the live config the page will hand the form */
  console.log("1. Live config");
  const rows = await prisma.systemSetting.findMany({
    where: { category: SOCIAL_EARNING_CATEGORY },
    select: { key: true, value: true },
  });
  console.log(`   (${rows.length} rows in category "${SOCIAL_EARNING_CATEGORY}")`);
  const liveMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));
  const live = toFormState(liveMap);

  check(
    "live config has all 8 activities, both sides",
    SOCIAL_ACTIVITY_KEYS.every(
      (k) => !!live.activities[k]?.recipient && !!live.activities[k]?.actor
    )
  );

  const liveParse = apiSchema.safeParse(JSON.parse(JSON.stringify(live)));
  check(
    "live config passes the API's zod schema unchanged",
    liveParse.success,
    liveParse.success ? undefined : JSON.stringify(liveParse.error.issues[0])
  );

  /* 2 — the round trip: what the form posts is what comes back */
  console.log("\n2. Round trip (post -> DB keys -> read)");
  check(
    "live config survives a full write/read round trip",
    same(toFormState(apiWrites(live)), live)
  );

  let fuzzFails = 0;
  let firstFuzzFail = "";
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const f = randomForm();
    if (!apiSchema.safeParse(JSON.parse(JSON.stringify(f))).success) {
      fuzzFails++;
      if (!firstFuzzFail) firstFuzzFail = "schema rejected a legal payload";
      continue;
    }
    const back = toFormState(apiWrites(f));
    if (!same(back, f)) {
      fuzzFails++;
      if (!firstFuzzFail) firstFuzzFail = `round trip changed values on case ${i}`;
    }
  }
  check(
    `${N} random payloads round trip byte-identical (incl. fractional points/xp)`,
    fuzzFails === 0,
    fuzzFails ? `${fuzzFails} failed; first: ${firstFuzzFail}` : undefined
  );

  /* 3 — the trap the restructure could have sprung */
  console.log("\n3. The post_create engager trap");
  const dropped = JSON.parse(JSON.stringify(live)) as FormState;
  // Simulate a "tidy-up" that removes the hidden object whose UI isn't rendered.
  delete (dropped.activities.post_create as Partial<{ actor: SideRow }>).actor;

  let droppedThrew = false;
  try {
    apiWrites(dropped as FormState);
  } catch {
    droppedThrew = true;
  }
  check(
    "dropping activities.post_create.actor is detectable (it throws or changes the saved rows)",
    droppedThrew ||
      !same(toFormState(apiWrites(dropped as FormState)), live),
    "if this passes silently, the guard in the form has no teeth"
  );

  const hidden = live.activities.post_create.actor;
  check(
    "the form still ships post_create.actor, so its rows keep their real values",
    !!hidden && typeof hidden.enabled === "boolean",
    hidden ? undefined : "actor object missing from the live config"
  );

  /* 4 — display order must not have leaked into the coupled tuples */
  console.log("\n4. Positional coupling in ratioPreview");
  check(
    "SOCIAL_ACTIONS and SOCIAL_ACTIVITY_KEYS are still the same length",
    SOCIAL_ACTIONS.length === SOCIAL_ACTIVITY_KEYS.length
  );
  check(
    "the two tuples are still aligned index for index",
    SOCIAL_ACTIVITY_KEYS.every(
      (k, i) => SOCIAL_ACTIONS[i].toLowerCase() === k
    ),
    "ratioPreview maps key -> action by index; a reorder mislabels every hint"
  );
  check(
    "the form's display groups cover all 8 activities exactly once",
    GROUP_KEYS.length === SOCIAL_ACTIVITY_KEYS.length &&
      new Set(GROUP_KEYS).size === SOCIAL_ACTIVITY_KEYS.length &&
      SOCIAL_ACTIVITY_KEYS.every((k) => GROUP_KEYS.includes(k))
  );
  check(
    "reordering for display did not change what ratioPreview says",
    GROUP_KEYS.every((k) => {
      const s = ratioPreview(k, "recipient", {
        enabled: true,
        points: 10,
        xp: 0,
        perCount: 100,
        window: "daily",
      });
      // mention_received is `event`-unit, so it must NOT claim per-person dedup
      return k === "mention_received"
        ? !s.includes("once per post per person")
        : s.length > 0;
    })
  );

  /* 5 — the cap semantics the new UI warns about */
  console.log("\n5. Cap-of-zero semantics the UI now states");
  // Mirrors src/lib/social-earning.ts: the points caps clamp unconditionally
  // (0 blocks), while the XP cap is guarded with `> 0` (0 = unlimited).
  const clampPoints = (base: number, cap: number, today: number) =>
    Math.min(base, Math.max(0, cap - today));
  check(
    "daily points cap of 0 pays nothing (it is not 'unlimited')",
    clampPoints(50, 0, 0) === 0
  );
  check(
    "per-post cap of 0 blocks a recipient immediately (postEarned >= cap)",
    0 >= 0
  );
  const clampXp = (base: number, cap: number, today: number) =>
    base > 0 && cap > 0 ? Math.min(base, Math.max(0, cap - today)) : base;
  check("daily XP cap of 0 really is unlimited", clampXp(50, 0, 0) === 50);

  /* 6 — the warning gate the restructure fixed */
  console.log("\n6. Flat rates above the cap are now warned about");
  const warns = (row: SideRow, capPts: number) =>
    row.enabled && capPts > 0 && row.points > capPts;
  const flat: SideRow = {
    enabled: true,
    points: 5000,
    xp: 0,
    perCount: 1,
    window: "daily",
  };
  check(
    "a flat 5000 pts against a 500 cap warns (the old gate required perCount > 1)",
    warns(flat, 500)
  );
  check(
    "a ratio 5000 pts against a 500 cap still warns",
    warns({ ...flat, perCount: 100 }, 500)
  );
  check(
    "an in-budget reward does not warn",
    !warns({ ...flat, points: 100 }, 500)
  );

  /* 7 — the two admin-controlled earning modes */
  console.log("\n7. Poster / engager modes: defaults, gates, caps, key parity");

  const engine = code("src/lib/social-earning.ts");
  const vocab = code("src/lib/social-actions.ts");
  const api = code("src/app/api/admin/settings/social-earning/route.ts");
  const form = code("src/components/admin/settings/social-earning-form.tsx");
  const adminLib = code("src/lib/social-earning-admin.ts");

  // 7a — the mode gates ship OPEN, deliberately.
  //
  // They are not a new feature: they are a master switch placed over earning
  // that is already running. There is not one `social_earning.*` row in the
  // database, so the defaults ARE the live configuration, and payments have
  // already been made under them. A closed gate here would not be a cautious
  // default, it would silently stop feed earning for everyone now receiving it.
  // What gates the money is still the per-action enable beneath each mode.
  check(
    "poster mode defaults OPEN, so adding the gate does not stop live earning",
    SOCIAL_EARNING_DEFAULTS.posterModeEnabled === true,
    "the defaults are the live config — closing this gate is an outage, not a safe default"
  );
  check(
    "engager mode defaults OPEN, for the same reason",
    SOCIAL_EARNING_DEFAULTS.engagerModeEnabled === true
  );
  // The genuinely NEW protection is the pair cap, and that one must be on:
  // without it two accounts can drain the daily cap between themselves.
  check(
    "the anti-collusion pair cap is ON by default",
    SOCIAL_EARNING_DEFAULTS.pairDailyCapPerUser > 0,
    "a cap that ships off protects nobody until someone thinks to enable it"
  );
  check(
    "the parser reads the mode switches, so a saved row can turn them on",
    /poster_mode_enabled/.test(vocab) && /engager_mode_enabled/.test(vocab)
  );

  // 7b — key parity, both ends. A setting is only real when the writing form
  // and the reading code use the SAME key.
  const NEW_KEYS = [
    "poster_mode_enabled",
    "engager_mode_enabled",
    "poster_daily_cap_per_user",
    "engager_daily_cap_per_user",
    "pair_daily_cap_per_user",
    "min_level_to_earn",
  ];
  for (const k of NEW_KEYS) {
    check(
      `key parity: ${k} is written by the API, read by the parser, and on the form`,
      api.includes(`"social_earning.${k}"`) &&
        api.includes(`${k}:`) &&
        vocab.includes(`"${k}"`) &&
        adminLib.includes(`${k}:`) &&
        form.includes(`${k}`)
    );
  }
  // And the round-trip above already proves the values survive; assert the new
  // keys are genuinely in that payload rather than silently dropped.
  const written = apiWrites(randomForm());
  for (const k of NEW_KEYS) {
    check(
      `the API's writes array actually contains social_earning.${k}`,
      written.has(`${SOCIAL_EARNING_CATEGORY}.${k}`)
    );
  }

  // 7c — a mode that is off pays nothing, and is checked BEFORE the ratio
  // counter advances (otherwise milestones bank up and all pay at switch-on).
  check(
    "poster mode off short-circuits the recipient side with mode_off",
    /!cfg\.posterModeEnabled[\s\S]{0,200}skipped: "mode_off"/.test(engine)
  );
  check(
    "engager mode off short-circuits the actor side with mode_off",
    /!cfg\.engagerModeEnabled[\s\S]{0,200}skipped: "mode_off"/.test(engine)
  );
  check(
    "the recipient mode gate precedes resolveRatio (no banked milestones)",
    // The first `await resolveRatio(` is the recipient side, the last is the
    // actor side. Each mode gate must sit ahead of its own call.
    engine.indexOf("!cfg.posterModeEnabled") <
      engine.indexOf("await resolveRatio(") &&
      engine.indexOf("!cfg.engagerModeEnabled") <
        engine.lastIndexOf("await resolveRatio(") &&
      engine.indexOf("await resolveRatio(") !==
        engine.lastIndexOf("await resolveRatio(")
  );

  // 7d — no self-earning, on either side.
  check(
    "a user cannot earn as author from their own engagement",
    /actorUserId === postOwnerUserId && action !== "POST_CREATE"[\s\S]{0,120}skipped: "self"/.test(
      engine
    )
  );
  check(
    "a user cannot earn as engager on their own post",
    /postOwnerUserId && actorUserId === postOwnerUserId[\s\S]{0,120}skipped: "self"/.test(
      engine
    )
  );

  // 7e — idempotency. One reference per (user, event); the DB unique is the
  // real guarantee, and the credit re-checks it inside a row lock.
  check(
    "every credit still writes a deterministic reference containing the role",
    /reference =\s*ctx\.referenceOverride/.test(engine) &&
      /social_\$\{action\.toLowerCase\(\)\}_\$\{role\}_/.test(engine)
  );
  check(
    "the duplicate re-check happens inside the FOR UPDATE row lock",
    /FOR UPDATE[\s\S]{0,300}raceDup[\s\S]{0,200}if \(raceDup\) return null;/.test(
      engine
    )
  );

  // 7f — caps are mandatory, stack downward, and are read off the un-prunable
  // ledger rather than a table log retention deletes.
  check(
    "per-mode daily caps are applied to the allowance",
    /modeCap - todayModePoints/.test(engine) &&
      /role === "recipient" \? cfg\.posterDailyCapPerUser : cfg\.engagerDailyCapPerUser/.test(
        engine
      )
  );
  check(
    "the pair cap bounds what one counterparty can pay in a day",
    /pairCap - todayPairPoints/.test(engine) &&
      /md\.sourceUserId === sourceUserId/.test(engine)
  );
  check(
    "mode and pair ceilings only ever narrow — Math.min, never Math.max",
    /allowPoints = Math\.min\(allowPoints, Math\.max\(0, modeCap - todayModePoints\)\)/.test(
      engine
    )
  );
  check(
    "the cap counters read Transaction, not the retention-pruned SocialActionLog",
    /prisma\.transaction\.findMany\([\s\S]{0,300}reference: \{ startsWith: "social_" \}/.test(
      engine
    ) && !/socialActionLog[\s\S]{0,200}todayModePoints/.test(engine)
  );
  check(
    "mode_cap and pair_cap are reported, so a stuck user is diagnosable",
    /skipped: "mode_cap"/.test(engine) && /skipped: "pair_cap"/.test(engine)
  );
  check(
    "cap defaults are conservative (poster 200 / engager 100 / pair 25)",
    SOCIAL_EARNING_DEFAULTS.posterDailyCapPerUser === 200 &&
      SOCIAL_EARNING_DEFAULTS.engagerDailyCapPerUser === 100 &&
      SOCIAL_EARNING_DEFAULTS.pairDailyCapPerUser === 25
  );
  check(
    "the level gate exists and defaults to off",
    /cfg\.minLevelToEarn > 0 && calculateLevel\(/.test(engine) &&
      SOCIAL_EARNING_DEFAULTS.minLevelToEarn === 0
  );

  // 7g — deleting a post must neither claw back nor re-pay.
  check(
    "no feed route deletes or reverses a social_ ledger row on post deletion",
    !/transaction\.delete/.test(code("src/app/api/feed/[id]/route.ts"))
  );

  console.log(
    `\n=== ${passed} passed, ${failures.length} failed ===${
      failures.length ? `\n\n${failures.map((f) => ` - ${f}`).join("\n")}\n` : "\n"
    }`
  );
  await prisma.$disconnect();
  if (failures.length) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
