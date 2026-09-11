/**
 * A buyer reporting ONE completion for an admin to look at again.
 *
 * Client-safe on purpose (no `server-only`, no Prisma): the buyer's form, the
 * API that accepts the report and the admin queue that resolves it all share
 * these bounds. A second copy of "reports allowed" in the UI is how a buyer
 * ends up being offered a button the server then refuses.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 * Buyers do not approve or reject their own tasks, and that rule is not
 * negotiable: a buyer holding their own credit has every incentive to refuse
 * work that was done properly, and the worker would carry the loss. But the
 * honest complaint is real too — the follow that was undone an hour later, the
 * screenshot that is plainly someone else's. Before this, the answer was
 * "contact support", which is not a system, it is a queue nobody can measure.
 *
 * ── Why it is bounded ───────────────────────────────────────────────────────
 * An unbounded report button IS a reject button: report everything, and every
 * completion becomes an admin argument the buyer can win by attrition. So:
 *   - one report per completion, ever;
 *   - only within `REPORT_WINDOW_DAYS` of the completion;
 *   - at most `reportAllowance(approved)` per task.
 * A buyer who thinks most of a task's work is bad has a task-level problem, and
 * that goes to support, where an admin can look at the whole thing.
 *
 * ── What a report does NOT do ───────────────────────────────────────────────
 * It moves no money. The worker keeps their points, the buyer's credit is not
 * returned, and the submission keeps its status. Reversing a payout is not
 * something this system does anywhere — an approved submission is final, by
 * design — so a report is a second opinion, and what an admin does with a
 * confirmed bad one is act on the ACCOUNT (warn, suspend, ban), not claw back
 * one reward.
 */

/** How long after a completion a buyer may report it. */
export const REPORT_WINDOW_DAYS = 7;

/** Shortest useful reason. An admin has to be able to act on this. */
export const MIN_REPORT_REASON = 10;

/** Longest reason kept. */
export const MAX_REPORT_REASON = 500;

/** Reports allowed on the smallest task — enough for a couple of bad ones. */
export const MIN_REPORT_ALLOWANCE = 2;

/** Share of a task's completions that may be reported, as a fraction. */
export const REPORT_ALLOWANCE_SHARE = 0.1;

export type BuyerReportStatus = "OPEN" | "UPHELD" | "DISMISSED";

export interface BuyerReport {
  status: BuyerReportStatus;
  /** The buyer's own words. Shown to the admin, never to the worker verbatim. */
  reason: string;
  /** ISO timestamp of the report. */
  at: string;
  /** The buyer who raised it. */
  by: string;
  resolvedAt?: string;
  resolvedBy?: string;
  /** The admin's note on resolution. */
  note?: string;
}

/**
 * How many completions of a task may be reported.
 *
 * A tenth, with a floor of two. The floor is what makes small tasks usable — a
 * 10% allowance on a task with 5 completions rounds to one, and a buyer with
 * two genuinely bad ones would be stuck. The share is what stops it becoming a
 * rejection queue on a large task.
 */
export function reportAllowance(approvedCount: number): number {
  return Math.max(
    MIN_REPORT_ALLOWANCE,
    Math.ceil(Math.max(0, approvedCount) * REPORT_ALLOWANCE_SHARE)
  );
}

/**
 * Pull a report out of a submission's `metadata` bag, or null.
 *
 * Validating rather than casting: `metadata` is free-form JSON that several
 * features write into, and a half-written or hand-edited blob must not be able
 * to render as a report.
 */
export function readBuyerReport(metadata: unknown): BuyerReport | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).buyerReport;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const status = String(r.status ?? "");
  if (status !== "OPEN" && status !== "UPHELD" && status !== "DISMISSED") {
    return null;
  }
  const reason = typeof r.reason === "string" ? r.reason : "";
  const at = typeof r.at === "string" ? r.at : "";
  const by = typeof r.by === "string" ? r.by : "";
  if (!reason || !at || !by) return null;
  return {
    status,
    reason,
    at,
    by,
    resolvedAt: typeof r.resolvedAt === "string" ? r.resolvedAt : undefined,
    resolvedBy: typeof r.resolvedBy === "string" ? r.resolvedBy : undefined,
    note: typeof r.note === "string" ? r.note : undefined,
  };
}

/** The JSON path a report lives at, so nobody hand-writes it in two places. */
export const BUYER_REPORT_PATH = ["buyerReport", "status"] as const;
