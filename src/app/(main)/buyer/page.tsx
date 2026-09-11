import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveFeatures } from "@/lib/packages";
import { getPointsPerUsd } from "@/lib/economy";
import { getBuyerSettings } from "@/lib/buyer-settings";
import { getBuyerScope } from "@/lib/buyer-scope";
import { SOCIAL_PLATFORMS } from "@/lib/social-tasks";
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

  const [buyer, pointsPerUsd, me, tasks, ledger, scope] = await Promise.all([
    getBuyerSettings(),
    getPointsPerUsd(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { cashBalance: true, taskCreditPoints: true },
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
        // Everything the edit form needs to seed itself — the same shape
        // `/api/tasks/mine/[id]` (PATCH) accepts. Fetched here rather than on
        // open because that route has no GET; editing an entry the list
        // never loaded would mean a second round trip for every open.
        description: true,
        instructions: true,
        socialUrl: true,
        socialPlatform: true,
        socialAction: true,
        minLevel: true,
        countries: true,
        genders: true,
        regions: true,
        divisions: true,
        districts: true,
        subDistricts: true,
        postalCodes: true,
        minAge: true,
        maxAge: true,
        _count: { select: { submissions: true } },
      },
    }),
    // The buyer's own money rows for task funding — the invoice history.
    prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          // Credit bought, credit spent per completion, the commission on
          // each, and the "published" marker. Everything that moved a buyer's
          // credit, in one list.
          { reference: { startsWith: "taskcredit_" } },
          { reference: { startsWith: "taskspend_" } },
          { reference: { startsWith: "task_fee_" } },
          { reference: { startsWith: "task_fund_" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        reference: true,
        description: true,
        amount: true,
        points: true,
        createdAt: true,
      },
    }),
    getBuyerScope(userId),
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
    description: string;
    instructions: string | null;
    socialUrl: string | null;
    socialPlatform: string | null;
    socialAction: string | null;
    minLevel: number;
    countries: string[];
    genders: string[];
    regions: string[];
    divisions: string[];
    districts: string[];
    subDistricts: string[];
    postalCodes: string[];
    minAge: number | null;
    maxAge: number | null;
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
    description: t.description,
    instructions: t.instructions,
    socialUrl: t.socialUrl,
    socialPlatform: t.socialPlatform,
    socialAction: t.socialAction,
    minLevel: t.minLevel,
    countries: t.countries,
    genders: t.genders,
    regions: t.regions,
    divisions: t.divisions,
    districts: t.districts,
    subDistricts: t.subDistricts,
    postalCodes: t.postalCodes,
    minAge: t.minAge,
    maxAge: t.maxAge,
  }));

  // Same catalog + scope filter the create form uses, so the edit form never
  // offers a platform this buyer is suspended from or the admin has closed.
  const platforms = SOCIAL_PLATFORMS.filter((p) =>
    scope.platforms.includes(p.key)
  ).map((p) => ({
    key: p.key,
    label: p.label,
    emoji: p.emoji,
    actions: p.actions.map((a) => ({ key: a.key, label: a.label })),
  }));

  const invoices: InvoiceRow[] = ledger.map((r) => ({
    id: r.id,
    reference: r.reference ?? "",
    description: r.description ?? "",
    amountUsd: toNum(r.amount),
    // Credit moves in POINTS; only a credit PURCHASE moves dollars. A row
    // carries whichever is real for it, and the hub renders that one.
    points: r.points ?? 0,
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  // Runway: how many more completions the credit can cover across the live
  // tasks, using the CHEAPEST live reward — that is the one that runs out
  // last, so it is the honest "you have this many left".
  //
  // Warning before it runs out rather than after is the whole point. A buyer
  // who finds out at zero has already had tasks stop; one who sees "about 4
  // completions left" can top up while everything is still running.
  const liveRewards = rows
    .filter((t) => t.status === "ACTIVE")
    .map((t) => t.pointsReward)
    .filter((n) => n > 0);
  const cheapestLive = liveRewards.length ? Math.min(...liveRewards) : 0;
  const feeOn = (n: number) =>
    buyer.feePercent > 0 ? Math.ceil((n * buyer.feePercent) / 100) : 0;
  const perCompletion = cheapestLive + feeOn(cheapestLive);
  const runway =
    perCompletion > 0
      ? Math.floor((me?.taskCreditPoints ?? 0) / perCompletion)
      : null;

  return (
    <BuyerHubView
      runway={runway}
      cashBalance={toNum(me?.cashBalance ?? 0)}
      taskCredit={me?.taskCreditPoints ?? 0}
      pointsPerUsd={pointsPerUsd}
      feePercent={buyer.feePercent}
      canCreate={buyer.enabled && buyer.allowedTaskTypes.length > 0}
      tasks={rows}
      invoices={invoices}
      platforms={platforms}
      canTarget={enabled.has("targetTasks")}
      minPoints={buyer.minPointsPerTask}
      maxPoints={buyer.maxPointsPerTask}
      maxCompletions={buyer.maxCompletions}
    />
  );
}
