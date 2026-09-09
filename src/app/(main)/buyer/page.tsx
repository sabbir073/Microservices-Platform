import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveFeatures } from "@/lib/packages";
import { getPointsPerUsd } from "@/lib/economy";
import { getBuyerSettings } from "@/lib/buyer-settings";
import { FeatureLock } from "@/components/user/primitives/feature-lock";
import { BuyerHubView, type BuyerTaskRow, type InvoiceRow } from "@/components/user/buyer/buyer-hub-view";
import { toNum } from "@/lib/money";

/**
 * The buyer's side of the platform.
 *
 * `/create-task` was a form and nothing else: once a buyer pressed Create, the
 * task vanished from their view entirely. They could not see whether it had
 * been approved, how many people had completed it, how much budget was left, or
 * what they had been charged — and if an admin rejected it, the reason existed
 * on the task row but was never shown to the person it was written for.
 *
 * Everything here is scoped to `fundedByUserId = me` in the QUERY, not filtered
 * after the fact, so there is no shape of request that returns another buyer's
 * tasks.
 */
export default async function BuyerHubPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const { enabled } = await getEffectiveFeatures(userId);
  if (!enabled.has("createTasks")) {
    return <FeatureLock title="Buyer Hub" applyHref="/profile/become-creator" />;
  }

  const [buyer, pointsPerUsd, me, tasks, ledger] = await Promise.all([
    getBuyerSettings(),
    getPointsPerUsd(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { cashBalance: true },
    }),
    prisma.task.findMany({
      where: { fundedByUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        pointsReward: true,
        totalLimit: true,
        budgetPoints: true,
        remainingBudget: true,
        rejectionReason: true,
        createdAt: true,
        _count: { select: { submissions: true } },
      },
    }),
    // The buyer's own money rows for task funding — the invoice history.
    prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          { reference: { startsWith: "task_fund_" } },
          { reference: { startsWith: "task_fee_" } },
          { reference: { startsWith: "task_refund_" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        reference: true,
        description: true,
        amount: true,
        createdAt: true,
      },
    }),
  ]);

  // Accelerate's inference collapses a wide `select` to `{}` the moment a
  // nested `_count` joins it, so the row shapes are restated and cast. Keep
  // these in step with the two selects above.
  type TaskRow = {
    id: string;
    title: string;
    type: string;
    status: string;
    pointsReward: number;
    totalLimit: number | null;
    budgetPoints: number;
    remainingBudget: number;
    rejectionReason: string | null;
    createdAt: Date;
    _count: { submissions: number };
  };
  const taskRows = tasks as unknown as TaskRow[];

  // Approved completions per task, in one grouped query rather than N.
  //
  // `_count.submissions` above counts every attempt including rejected and
  // pending ones. Showing that as "completed" would tell a buyer 40 people had
  // done the job when 3 had, so the approved count is fetched separately.
  const approved = (
    taskRows.length
      ? await prisma.taskSubmission.groupBy({
          by: ["taskId"],
          where: {
            taskId: { in: taskRows.map((t) => t.id) },
            status: { in: ["APPROVED", "AUTO_APPROVED"] },
          },
          _count: { _all: true },
        })
      : []
  ) as unknown as { taskId: string; _count: { _all: number } }[];
  const approvedByTask = new Map(
    approved.map((r) => [r.taskId, r._count._all])
  );

  const rows: BuyerTaskRow[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    type: String(t.type),
    status: String(t.status),
    pointsReward: t.pointsReward,
    targetCount: t.totalLimit ?? 0,
    budgetPoints: t.budgetPoints,
    remainingBudget: t.remainingBudget,
    approvedCount: approvedByTask.get(t.id) ?? 0,
    pendingCount: Math.max(
      0,
      t._count.submissions - (approvedByTask.get(t.id) ?? 0)
    ),
    rejectionReason: t.rejectionReason,
    createdAt: new Date(t.createdAt).toISOString(),
  }));

  const invoices: InvoiceRow[] = ledger.map((r) => ({
    id: r.id,
    reference: r.reference ?? "",
    description: r.description ?? "",
    amountUsd: toNum(r.amount),
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  return (
    <BuyerHubView
      cashBalance={toNum(me?.cashBalance ?? 0)}
      pointsPerUsd={pointsPerUsd}
      feePercent={buyer.feePercent}
      canCreate={buyer.enabled && buyer.allowedTaskTypes.length > 0}
      tasks={rows}
      invoices={invoices}
    />
  );
}
