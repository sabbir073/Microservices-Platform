import { prisma } from "@/lib/prisma";

export interface CourseCommissionConfig {
  /** Default platform-commission in basis points (1 bps = 0.01%).
   *  e.g. 2000 = 20% platform fee, 80% to tutor. */
  default: number;
  /** Per-category overrides keyed by CourseCategory.slug (uppercased). */
  byCategory?: Record<string, number>;
}

const SETTING_KEY = "course_commission_rates";

export const DEFAULT_COURSE_COMMISSION: CourseCommissionConfig = {
  default: 2000, // 20%
  byCategory: {},
};

export async function getCourseCommissionConfig(): Promise<CourseCommissionConfig> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY },
  });
  if (!row?.value || typeof row.value !== "object") {
    return DEFAULT_COURSE_COMMISSION;
  }
  const v = row.value as Partial<CourseCommissionConfig>;
  return {
    default:
      typeof v.default === "number"
        ? clampBps(v.default)
        : DEFAULT_COURSE_COMMISSION.default,
    byCategory:
      v.byCategory && typeof v.byCategory === "object"
        ? Object.fromEntries(
            Object.entries(v.byCategory).map(([k, n]) => [
              k.toUpperCase(),
              clampBps(Number(n) || 0),
            ])
          )
        : {},
  };
}

/** Resolve the platform-commission rate (bps) to apply for a particular course.
 *  Precedence:
 *   1. `Course.commissionRateBps` per-course override
 *   2. `byCategory[categorySlug]` from settings
 *   3. `default` from settings (20% if unset) */
export async function resolveCourseCommissionBps(opts: {
  categorySlug: string | null | undefined;
  perCourseOverride: number | null | undefined;
}): Promise<number> {
  if (
    typeof opts.perCourseOverride === "number" &&
    opts.perCourseOverride >= 0
  ) {
    return clampBps(opts.perCourseOverride);
  }
  const cfg = await getCourseCommissionConfig();
  if (opts.categorySlug) {
    const byType = cfg.byCategory?.[opts.categorySlug.toUpperCase()];
    if (typeof byType === "number") return clampBps(byType);
  }
  return clampBps(cfg.default);
}

/** Split an enrollment price into platform fee + tutor amount based on bps. */
export function splitCoursePrice(amount: number, bps: number) {
  const safeBps = clampBps(bps);
  const fee = Math.round(((amount * safeBps) / 10000) * 100) / 100;
  const tutorAmount = Math.round((amount - fee) * 100) / 100;
  return { fee, tutorAmount };
}

function clampBps(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_COURSE_COMMISSION.default;
  return Math.max(0, Math.min(10000, Math.round(n)));
}

export async function saveCourseCommissionConfig(
  cfg: CourseCommissionConfig
): Promise<void> {
  const payload: CourseCommissionConfig = {
    default: clampBps(cfg.default),
    byCategory: cfg.byCategory
      ? Object.fromEntries(
          Object.entries(cfg.byCategory).map(([k, n]) => [
            k.toUpperCase(),
            clampBps(Number(n) || 0),
          ])
        )
      : {},
  };
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    create: {
      key: SETTING_KEY,
      category: "courses",
      value: payload as unknown as object,
    },
    update: {
      category: "courses",
      value: payload as unknown as object,
    },
  });
}
