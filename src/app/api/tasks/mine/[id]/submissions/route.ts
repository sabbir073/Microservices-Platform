import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getBuyerSettings } from "@/lib/buyer-settings";
import { writeAudit } from "@/lib/audit";
import {
  MAX_REPORT_REASON,
  MIN_REPORT_REASON,
  REPORT_WINDOW_DAYS,
  readBuyerReport,
  reportAllowance,
  type BuyerReport,
} from "@/lib/buyer-reports";
import { TASK_SPEND_REF } from "@/lib/task-credit";

/**
 * The work a buyer paid for — what was done, what it cost, and how it is going.
 *
 * A buyer could see that 10 of 100 people had completed their task and nothing
 * about what those 10 actually did. They are paying for work they cannot look
 * at, which is an odd thing to ask of anyone.
 *
 * There is deliberately no approve or reject here. A buyer holding their own
 * credit has every incentive to refuse work that was done properly, and the
 * worker would carry that loss — so judging submissions stays with admins and
 * Smart Auto Verification. What POST adds is the ONE thing a buyer legitimately
 * needs and could not do: flag a specific completion for an admin to look at
 * again. It is bounded (see `buyer-reports.ts`), it moves no money and it
 * changes no submission status — a report is a request for a second opinion,
 * not a rejection wearing a different hat.
 *
 * Two things are withheld on purpose:
 *  - **Who did it.** A buyer does not need the worker's identity to check the
 *    work, and handing over a list of everyone who engaged with their brand
 *    invites off-platform contact. The proof is what they bought. The audience
 *    breakdown below is aggregate for the same reason.
 *  - **Pending submissions.** Showing work before it has been judged invites a
 *    buyer to lobby about it, which is the pressure this split exists to avoid.
 */

const DAY_MS = 86_400_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const userId = session.user.id;

  // Ownership in the query: no request shape reaches another buyer's task.
  const task = (await prisma.task.findFirst({
    where: { id, fundedByUserId: userId },
    select: {
      id: true,
      createdAt: true,
      pointsReward: true,
      totalLimit: true,
      budgetPoints: true,
      remainingBudget: true,
      status: true,
    },
  })) as unknown as {
    id: string;
    createdAt: Date;
    pointsReward: number;
    totalLimit: number | null;
    budgetPoints: number;
    remainingBudget: number;
    status: string;
  } | null;
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const rows = (await prisma.taskSubmission.findMany({
    where: {
      taskId: id,
      // Approved only — see the note above.
      status: { in: ["APPROVED", "AUTO_APPROVED"] },
    },
    orderBy: { reviewedAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      proof: true,
      proofImages: true,
      reviewedAt: true,
      createdAt: true,
      pointsEarned: true,
      metadata: true,
    },
  })) as unknown as {
    id: string;
    status: string;
    proof: string | null;
    proofImages: string[];
    reviewedAt: Date | null;
    createdAt: Date;
    pointsEarned: number | null;
    metadata: unknown;
  }[];

  // ── The numbers an advertiser judges a campaign on ──────────────────────────
  //
  // Counts by status rather than "everything minus approved": a rejected
  // submission was being shown to the buyer as one still awaiting review, so a
  // task whose fraud attempts had all been thrown out looked like a task with a
  // review backlog.
  const byStatus = (await prisma.taskSubmission.groupBy({
    by: ["status"],
    where: { taskId: id },
    _count: { _all: true },
  })) as unknown as { status: string; _count: { _all: number } }[];
  const countOf = (...s: string[]) =>
    byStatus
      .filter((r) => s.includes(String(r.status)))
      .reduce((n, r) => n + r._count._all, 0);
  const approved = countOf("APPROVED", "AUTO_APPROVED");
  const pending = countOf("PENDING");
  const rejected = countOf("REJECTED");

  // Cost comes from the LEDGER, not from arithmetic on the reward: these are
  // the exact rows the invoice tab lists, so "cost per completion" here and the
  // invoice history can never tell the buyer two different stories.
  const spend = (await prisma.transaction.aggregate({
    where: { userId, reference: { startsWith: `${TASK_SPEND_REF}${id}_` } },
    _sum: { points: true },
  })) as unknown as { _sum: { points: number | null } };
  const fees = (await prisma.transaction.aggregate({
    where: { userId, reference: { startsWith: `task_fee_${id}_` } },
    _sum: { points: true },
  })) as unknown as { _sum: { points: number | null } };
  // Charges are stored negative; flip once, here, rather than at each use.
  const rewardPaid = -(spend._sum.points ?? 0);
  const feePaid = -(fees._sum.points ?? 0);
  const totalPaid = rewardPaid + feePaid;

  // Time to fill, measured from when the task was created rather than modelled.
  const span = (await prisma.taskSubmission.aggregate({
    where: { taskId: id, status: { in: ["APPROVED", "AUTO_APPROVED"] } },
    _min: { createdAt: true },
    _max: { createdAt: true },
  })) as unknown as { _min: { createdAt: Date | null }; _max: { createdAt: Date | null } };

  const now = Date.now();
  const liveDays = Math.max(
    0.25,
    (now - new Date(task.createdAt).getTime()) / DAY_MS
  );
  const perDay = approved / liveDays;
  const target = task.totalLimit ?? 0;
  const left = Math.max(0, target - approved);

  // Which audience actually delivered — aggregate, never per person. Capped at
  // 500 workers: this is a shape-of-the-audience answer, not a register.
  const workers = (await prisma.taskSubmission.findMany({
    where: { taskId: id, status: { in: ["APPROVED", "AUTO_APPROVED"] } },
    select: { userId: true },
    take: 500,
  })) as unknown as { userId: string }[];
  const workerIds = [...new Set(workers.map((w) => w.userId))];
  const byCountry = workerIds.length
    ? ((await prisma.user.groupBy({
        by: ["country"],
        where: { id: { in: workerIds } },
        _count: { _all: true },
      })) as unknown as { country: string | null; _count: { _all: number } }[])
    : [];

  const buyer = await getBuyerSettings();
  const allowance = reportAllowance(approved);
  // Counted with the SAME query the POST cap uses, not by scanning the 100 rows
  // above: on a task with more completions than that, a buyer would be offered
  // a report button the server then refuses.
  const reportsUsed = await prisma.taskSubmission.count({
    where: {
      taskId: id,
      metadata: { path: ["buyerReport", "status"], not: Prisma.DbNull },
    },
  });

  return NextResponse.json({
    submissions: rows.map((r) => {
      const report = readBuyerReport(r.metadata);
      const at = r.reviewedAt ?? r.createdAt;
      return {
        id: r.id,
        status: String(r.status),
        proof: r.proof ?? null,
        proofImages: r.proofImages ?? [],
        pointsPaid: r.pointsEarned ?? 0,
        at: at.toISOString(),
        report: report
          ? { status: report.status, reason: report.reason, at: report.at }
          : null,
        // Reporting closes after a week: a buyer looking at three-month-old
        // work is not checking it, they are hunting for a refund.
        reportable:
          !report && now - at.getTime() < REPORT_WINDOW_DAYS * DAY_MS,
      };
    }),
    stats: {
      approved,
      pending,
      rejected,
      target,
      /** Of everything submitted, how much was accepted. */
      acceptRate:
        approved + rejected > 0 ? approved / (approved + rejected) : null,
      /** Of what was promised, how much has been delivered. */
      fillRate: target > 0 ? Math.min(1, approved / target) : null,
      rewardPaid,
      feePaid,
      totalPaid,
      costPerCompletion: approved > 0 ? totalPaid / approved : null,
      feePercent: buyer.feePercent,
      firstCompletionAt: span._min.createdAt
        ? new Date(span._min.createdAt).toISOString()
        : null,
      lastCompletionAt: span._max.createdAt
        ? new Date(span._max.createdAt).toISOString()
        : null,
      hoursToFirst: span._min.createdAt
        ? (new Date(span._min.createdAt).getTime() -
            new Date(task.createdAt).getTime()) /
          3_600_000
        : null,
      perDay,
      /** Days to deliver the rest at the rate this task has actually run at. */
      daysLeft: left > 0 && perDay > 0 ? Math.ceil(left / perDay) : null,
      countries: byCountry
        .map((c) => ({ country: c.country || "Unknown", count: c._count._all }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      reportsUsed,
      reportsAllowed: allowance,
    },
  });
}

/**
 * Report ONE completion for an admin to look at again.
 *
 * Deliberately not a rejection: the worker keeps their points, the submission
 * keeps its status, and nothing is refunded by this call. All it does is put
 * the completion in front of a human with the buyer's reason attached.
 *
 * Bounded three ways, because "report everything" is rejection by another name:
 *  - one report per submission, ever;
 *  - only within `REPORT_WINDOW_DAYS` of the completion;
 *  - at most `reportAllowance(approved)` reports on a task.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const submissionId = String(body.submissionId ?? "");
  const reason = String(body.reason ?? "").trim();
  if (!submissionId) {
    return NextResponse.json({ error: "Missing submission" }, { status: 400 });
  }
  if (reason.length < MIN_REPORT_REASON || reason.length > MAX_REPORT_REASON) {
    return NextResponse.json(
      {
        error: `Say what is wrong with it, in ${MIN_REPORT_REASON}–${MAX_REPORT_REASON} characters. An admin reads this.`,
      },
      { status: 400 }
    );
  }

  // Ownership in the query, on the TASK — a submission id alone must never be
  // enough to touch a row.
  const task = (await prisma.task.findFirst({
    where: { id, fundedByUserId: userId },
    select: { id: true, title: true },
  })) as unknown as { id: string; title: string } | null;
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const sub = (await prisma.taskSubmission.findFirst({
    where: {
      id: submissionId,
      taskId: id,
      status: { in: ["APPROVED", "AUTO_APPROVED"] },
    },
    select: {
      id: true,
      userId: true,
      metadata: true,
      reviewedAt: true,
      createdAt: true,
    },
  })) as unknown as {
    id: string;
    userId: string;
    metadata: unknown;
    reviewedAt: Date | null;
    createdAt: Date;
  } | null;
  if (!sub) {
    return NextResponse.json({ error: "Completion not found" }, { status: 404 });
  }

  if (readBuyerReport(sub.metadata)) {
    return NextResponse.json(
      { error: "You have already reported this one. An admin will look at it." },
      { status: 409 }
    );
  }

  const at = sub.reviewedAt ?? sub.createdAt;
  if (Date.now() - new Date(at).getTime() > REPORT_WINDOW_DAYS * DAY_MS) {
    return NextResponse.json(
      {
        error: `Completions can be reported for ${REPORT_WINDOW_DAYS} days. This one is older than that — contact support if it still matters.`,
      },
      { status: 400 }
    );
  }

  const approved = await prisma.taskSubmission.count({
    where: { taskId: id, status: { in: ["APPROVED", "AUTO_APPROVED"] } },
  });
  const allowance = reportAllowance(approved);
  const used = await prisma.taskSubmission.count({
    where: {
      taskId: id,
      metadata: { path: ["buyerReport", "status"], not: Prisma.DbNull },
    },
  });
  if (used >= allowance) {
    return NextResponse.json(
      {
        error: `You have reported ${used} completion${used === 1 ? "" : "s"} on this task, which is the limit for its size. Reporting is for the odd bad one — if most of the work is wrong, contact support and an admin will review the whole task.`,
      },
      { status: 429 }
    );
  }

  const report: BuyerReport = {
    status: "OPEN",
    reason,
    at: new Date().toISOString(),
    by: userId,
  };
  const existing =
    sub.metadata && typeof sub.metadata === "object"
      ? (sub.metadata as Record<string, unknown>)
      : {};
  // Merge, never replace: `metadata` carries the SOCIAL proof bag, and writing
  // the report on its own would erase the very evidence being reported.
  await prisma.taskSubmission.update({
    where: { id: sub.id },
    data: { metadata: { ...existing, buyerReport: report } as never },
  });

  await writeAudit({
    actorId: userId,
    action: "BUYER_REPORTED_COMPLETION",
    entity: "TaskSubmission",
    entityId: sub.id,
    // The worker is the one affected, so this shows on THEIR activity too —
    // an accusation nobody can see is one nobody can answer.
    targetUserId: sub.userId,
    summary: `Buyer reported a completion on "${task.title}"`,
    meta: { taskId: id, reason },
  });

  return NextResponse.json({
    ok: true,
    reportsUsed: used + 1,
    reportsAllowed: allowance,
  });
}
