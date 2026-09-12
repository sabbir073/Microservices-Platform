import "server-only";
import { prisma } from "@/lib/prisma";
import { toNum } from "@/lib/money";

/**
 * What a staff member can earn commission ON.
 *
 * Every basis here is read from a column that **already exists and is already
 * written** — no new tracking, no new schema. The platform has been recording
 * who reviewed what for a long time and nothing has ever read those columns for
 * anything but a single-row "reviewed by" label:
 *
 * | basis              | column                                        |
 * |--------------------|-----------------------------------------------|
 * | submission review  | `TaskSubmission.reviewedBy` / `reviewedAt`    |
 * | deposit approval   | `Deposit.reviewedBy` / `reviewedAt`           |
 * | withdrawal payout  | `Withdrawal.processedBy` / `processedAt`      |
 * | KYC review         | `KYCDocument.reviewedBy` / `reviewedAt`       |
 * | ad review          | `Ad.reviewedById` / `reviewedAt`              |
 * | listing review     | `MarketplaceListing.reviewedById`/`reviewedAt`|
 * | moderation         | `SocialReport.resolvedById` / `resolvedAt`    |
 *
 * Two shapes of rate apply to each: a flat amount per item, and a percentage of
 * the money the item carried. Only deposits and withdrawals carry money, so
 * `hasValue` says which bases the percentage is meaningful for — the console
 * hides the percent field on the rest rather than offering a number that would
 * always multiply by zero.
 *
 * The rates themselves live in settings and ship at zero. This file decides
 * WHAT counts, never HOW MUCH.
 */

export interface BasisDef {
  key: string;
  label: string;
  /** What one "unit" is, for the per-unit rate's label. */
  unit: string;
  /** True when the item carries a USD value a percentage can be taken of. */
  hasValue: boolean;
  /** Shown under the rate inputs so the owner knows what he is pricing. */
  source: string;
}

export const BASES: BasisDef[] = [
  {
    key: "submission_review",
    label: "Task submissions reviewed",
    unit: "submission",
    hasValue: false,
    source: "TaskSubmission.reviewedBy — approvals and rejections both count.",
  },
  {
    key: "deposit_approval",
    label: "Deposits approved",
    unit: "deposit",
    hasValue: true,
    source: "Deposit.reviewedBy, status APPROVED. Value = the deposit amount.",
  },
  {
    key: "withdrawal_payout",
    label: "Withdrawals paid out",
    unit: "withdrawal",
    hasValue: true,
    source:
      "Withdrawal.processedBy, status COMPLETED. Value = the amount paid.",
  },
  {
    key: "kyc_review",
    label: "KYC documents reviewed",
    unit: "document",
    hasValue: false,
    source: "KYCDocument.reviewedBy.",
  },
  {
    key: "ad_review",
    label: "Ad creatives reviewed",
    unit: "ad",
    hasValue: false,
    source: "Ad.reviewedById — the ad-review gate in src/lib/ad-review.ts.",
  },
  {
    key: "listing_review",
    label: "Marketplace listings reviewed",
    unit: "listing",
    hasValue: false,
    source: "MarketplaceListing.reviewedById.",
  },
  {
    key: "moderation",
    label: "Reports resolved",
    unit: "report",
    hasValue: false,
    source:
      "SocialReport.resolvedById — the closest thing to a support queue; there is no ticket model.",
  },
];

export const BASIS_KEYS = BASES.map((b) => b.key);

/** One staff member's measured work on one basis, in one period. */
export interface BasisTally {
  count: number;
  /** Total USD the counted items carried. Zero where `hasValue` is false. */
  valueUsd: number;
}

/** staffId → basisKey → tally. */
export type ActivityMap = Record<string, Record<string, BasisTally>>;

function blank(): BasisTally {
  return { count: 0, valueUsd: 0 };
}

function put(
  map: ActivityMap,
  staffId: string | null | undefined,
  key: string,
  count: number,
  valueUsd: number
) {
  if (!staffId) return;
  const row = (map[staffId] ??= {});
  const cell = (row[key] ??= blank());
  cell.count += count;
  cell.valueUsd += valueUsd;
}

/**
 * Measure every staff member's work in `[from, to)`.
 *
 * Seven `groupBy`s in one `Promise.all`. Prisma's `groupBy` generics collapse to
 * `{}` inside a tuple — the same gotcha the rest of the finance code documents —
 * so each result is restated and cast rather than inferred.
 *
 * Counts everyone who appears in the columns, staff or not. The caller decides
 * who is on the payroll; a person who left the company still has to appear on
 * the period they worked.
 */
export async function getActivity(from: Date, to: Date): Promise<ActivityMap> {
  const window = { gte: from, lt: to };

  type ById<K extends string> = Array<
    Record<K, string | null> & { _count: { _all: number } }
  >;
  type ByIdWithAmount<K extends string> = Array<
    Record<K, string | null> & {
      _count: { _all: number };
      _sum: { amount: unknown };
    }
  >;

  const [subs, deposits, withdrawals, kyc, ads, listings, reports] =
    (await Promise.all([
      prisma.taskSubmission.groupBy({
        by: ["reviewedBy"],
        where: { reviewedBy: { not: null }, reviewedAt: window },
        _count: { _all: true },
      }),
      prisma.deposit.groupBy({
        by: ["reviewedBy"],
        where: {
          reviewedBy: { not: null },
          reviewedAt: window,
          status: "APPROVED",
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.withdrawal.groupBy({
        by: ["processedBy"],
        where: {
          processedBy: { not: null },
          processedAt: window,
          status: "COMPLETED",
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.kYCDocument.groupBy({
        by: ["reviewedBy"],
        where: { reviewedBy: { not: null }, reviewedAt: window },
        _count: { _all: true },
      }),
      prisma.ad.groupBy({
        by: ["reviewedById"],
        where: { reviewedById: { not: null }, reviewedAt: window },
        _count: { _all: true },
      }),
      prisma.marketplaceListing.groupBy({
        by: ["reviewedById"],
        where: { reviewedById: { not: null }, reviewedAt: window },
        _count: { _all: true },
      }),
      prisma.socialReport.groupBy({
        by: ["resolvedById"],
        where: { resolvedById: { not: null }, resolvedAt: window },
        _count: { _all: true },
      }),
    ])) as unknown as [
      ById<"reviewedBy">,
      ByIdWithAmount<"reviewedBy">,
      ByIdWithAmount<"processedBy">,
      ById<"reviewedBy">,
      ById<"reviewedById">,
      ById<"reviewedById">,
      ById<"resolvedById">,
    ];

  const map: ActivityMap = {};
  for (const r of subs) put(map, r.reviewedBy, "submission_review", r._count._all, 0);
  for (const r of deposits) {
    put(map, r.reviewedBy, "deposit_approval", r._count._all, toNum(r._sum.amount as never));
  }
  for (const r of withdrawals) {
    put(map, r.processedBy, "withdrawal_payout", r._count._all, toNum(r._sum.amount as never));
  }
  for (const r of kyc) put(map, r.reviewedBy, "kyc_review", r._count._all, 0);
  for (const r of ads) put(map, r.reviewedById, "ad_review", r._count._all, 0);
  for (const r of listings) put(map, r.reviewedById, "listing_review", r._count._all, 0);
  for (const r of reports) put(map, r.resolvedById, "moderation", r._count._all, 0);
  return map;
}
