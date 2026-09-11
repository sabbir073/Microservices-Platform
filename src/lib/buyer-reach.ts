import "server-only";
import { prisma } from "@/lib/prisma";
import { NON_STAFF_WHERE } from "@/lib/staff";
import type { TaskAudience } from "@/lib/task-targeting";

/**
 * "How many people will actually see this, and how long will it take to fill?"
 *
 * A buyer picked a country, a gender, an age window and a minimum level with no
 * idea whether that described forty thousand people or none. They published,
 * paid for one completion's worth of credit, and then waited — and a task that
 * matches nobody looks exactly like a task nobody has got around to yet. There
 * was nothing on the platform that could tell those two apart before the money
 * was spent.
 *
 * Two numbers answer it:
 *  - **Reach** — how many workers match the audience as the serve query defines
 *    it. Counted with the same STRICT rule `task-targeting.ts` enforces at serve
 *    time (target a dimension and a worker with no value for it is excluded), so
 *    the estimate cannot promise an audience the task will not be shown to.
 *  - **Throughput** — what tasks of this type have actually been completed at,
 *    per task per day, over the last 30 days. Measured, not modelled: there is
 *    no elasticity curve here pretending to know what an extra 10 points buys.
 *    The sample's median reward is returned beside it so a buyer offering half
 *    that can see why their estimate is optimistic.
 */

/** Fewer matching workers than this and the exact number is withheld. */
const TOO_NARROW = 10;

/** Days of history the throughput sample looks back over. */
const SAMPLE_DAYS = 30;

/** Most tasks sampled for the throughput figure. */
const SAMPLE_TASKS = 200;

export interface ReachEstimate {
  /**
   * Workers matching the audience, or null when fewer than `TOO_NARROW` match.
   *
   * Null is not "none" — `tooNarrow` says which. A targeted-down-to-a-postcode
   * audience can identify one real person, and handing a buyer "1" confirms
   * that person is on the platform. Below the floor the buyer is told the
   * targeting is too narrow, which is the advice they needed anyway.
   */
  eligible: number | null;
  /** True when the audience matched fewer than 10 people (exact count withheld). */
  tooNarrow: boolean;
  /** Nothing at all matched — a distinct, actionable answer from "too narrow". */
  empty: boolean;
  /** Of the matching workers, how many signed in within the last 30 days. */
  activeRecently: number | null;
  /** Measured completions per task per day for this type, or null if no sample. */
  perTaskPerDay: number | null;
  /** Tasks the throughput figure was measured over. */
  sampleSize: number;
  /** Median reward across the sample, so a low offer can be seen as a low offer. */
  sampleMedianReward: number | null;
  /** Rough days to reach `completions` at the measured rate, or null. */
  daysToFill: number | null;
}

/**
 * The user-side mirror of `taskAudienceWhere`.
 *
 * That function answers "which tasks may this worker see"; this one answers
 * "which workers will see this task", which is the question a buyer is asking
 * before they publish. STRICT in the same direction: a targeted dimension
 * requires the worker to hold one of the targeted values, so a null profile
 * field excludes them — exactly as it does at serve time.
 */
export function audienceUserWhere(
  audience: TaskAudience,
  minLevel: number,
  now: Date = new Date()
): Record<string, unknown> {
  const where: Record<string, unknown> = {
    ...NON_STAFF_WHERE,
    // Only people who can actually work: suspended, banned and never-verified
    // accounts are not an audience a buyer is buying.
    status: "ACTIVE",
  };
  if (minLevel > 1) where.level = { gte: minLevel };

  const dims: [keyof TaskAudience, string][] = [
    ["countries", "country"],
    ["genders", "gender"],
    ["regions", "region"],
    ["divisions", "division"],
    ["districts", "district"],
    ["subDistricts", "subDistrict"],
    ["postalCodes", "postalCode"],
  ];
  for (const [field, userKey] of dims) {
    const values = (audience[field] as string[] | undefined) ?? [];
    if (values.length > 0) where[userKey] = { in: values };
  }

  // Age is stored as a birth date, so the window is expressed as a date range.
  // A worker with no date of birth is excluded whenever an age bound is set —
  // the serve-time check does the same, and an estimate that counted them
  // would over-promise.
  const dob: Record<string, Date> = {};
  if (audience.maxAge != null) {
    // Oldest birth date still inside the window: born after (today - (max+1)y).
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - (audience.maxAge + 1));
    dob.gt = d;
  }
  if (audience.minAge != null) {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - audience.minAge);
    dob.lte = d;
  }
  if (Object.keys(dob).length > 0) where.dateOfBirth = dob;

  return where;
}

/**
 * Reach + throughput for a task a buyer has not published yet.
 *
 * Read-only and safe to call on every keystroke-debounced change of the form.
 */
export async function estimateReach(args: {
  audience: TaskAudience;
  minLevel: number;
  type: string;
  completions: number;
  pointsReward: number;
}): Promise<ReachEstimate> {
  const now = new Date();
  const where = audienceUserWhere(args.audience, args.minLevel, now);

  const since = new Date(now.getTime() - SAMPLE_DAYS * 86_400_000);
  const eligible = await prisma.user.count({
    where: where as never,
  });

  const activeRecently =
    eligible >= TOO_NARROW
      ? await prisma.user.count({
          where: { ...where, lastLoginAt: { gte: since } } as never,
        })
      : null;

  // Throughput, measured off real tasks of the same type. Ids first, then a
  // count over them: `TaskSubmission` is indexed on [taskId, status], and a
  // relation filter through `task` would not use it.
  const sample = (await prisma.task.findMany({
    where: {
      type: args.type as never,
      createdAt: { gte: since },
      status: { in: ["ACTIVE", "COMPLETED", "PAUSED", "EXPIRED"] },
    },
    orderBy: { createdAt: "desc" },
    take: SAMPLE_TASKS,
    select: { id: true, pointsReward: true, createdAt: true },
  })) as unknown as { id: string; pointsReward: number; createdAt: Date }[];

  let perTaskPerDay: number | null = null;
  let sampleMedianReward: number | null = null;
  if (sample.length > 0) {
    const approvals = await prisma.taskSubmission.count({
      where: {
        taskId: { in: sample.map((t) => t.id) },
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
        createdAt: { gte: since },
      },
    });
    // Days each sampled task has actually been live, not a flat 30: a task
    // created yesterday would otherwise drag the average down by 29 days it
    // never had.
    const taskDays = sample.reduce((s, t) => {
      const days = (now.getTime() - new Date(t.createdAt).getTime()) / 86_400_000;
      return s + Math.max(1, Math.min(SAMPLE_DAYS, days));
    }, 0);
    perTaskPerDay = taskDays > 0 ? approvals / taskDays : null;

    const rewards = sample.map((t) => t.pointsReward).sort((a, b) => a - b);
    sampleMedianReward = rewards[Math.floor(rewards.length / 2)] ?? null;
  }

  const daysToFill =
    perTaskPerDay && perTaskPerDay > 0
      ? Math.ceil(args.completions / perTaskPerDay)
      : null;

  return {
    eligible: eligible >= TOO_NARROW ? eligible : null,
    tooNarrow: eligible > 0 && eligible < TOO_NARROW,
    empty: eligible === 0,
    activeRecently,
    perTaskPerDay,
    sampleSize: sample.length,
    sampleMedianReward,
    daysToFill,
  };
}
