import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCanFeature } from "@/lib/packages";
import { getPointsPerUsd } from "@/lib/economy";
import { sanitizeTaskAudience, EMPTY_TASK_AUDIENCE } from "@/lib/task-targeting";
import { getBuyerSettings, quoteTask } from "@/lib/buyer-settings";
import { spendTaskCredit, getTaskCredit } from "@/lib/task-credit";
import { KYCStatus } from "@/generated/prisma/client";
import { TransactionType, TransactionStatus, TaskType } from "@/generated/prisma/client";

// Task types this endpoint knows how to build. WHICH of them a buyer may
// actually use is an admin setting (`buyer.allowed_task_types`) checked below —
// this tuple is only the set the schema can parse.
const ALLOWED_TYPES = ["SOCIAL", "CUSTOM"] as const;

const schema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(2000),
  type: z.enum(ALLOWED_TYPES),
  // The real floor and ceiling are admin settings (Buyer & Task Funding) and
  // are enforced after parsing; these are only sanity bounds so a hostile body
  // cannot make the arithmetic below overflow.
  pointsReward: z.number().int().min(1).max(10_000_000),
  targetCount: z.number().int().min(1).max(10_000_000), // total completions to fund
  minLevel: z.number().int().min(1).max(100).default(1),
  // SOCIAL
  socialPlatform: z.string().max(40).optional().nullable(),
  socialAction: z.string().max(40).optional().nullable(),
  socialUrl: z.string().url().optional().nullable(),
  // CUSTOM
  instructions: z.string().max(4000).optional().nullable(),
  // Audience targeting (only honored when the user has the `targetTasks` feature).
  countries: z.array(z.string().max(8)).max(50).optional(),
  genders: z.array(z.string().max(10)).max(5).optional(),
  regions: z.array(z.string().max(80)).max(100).optional(),
  divisions: z.array(z.string().max(80)).max(100).optional(),
  districts: z.array(z.string().max(80)).max(300).optional(),
  subDistricts: z.array(z.string().max(80)).max(600).optional(),
  postalCodes: z.array(z.string().max(16)).max(300).optional(),
  minAge: z.number().int().min(0).max(120).nullable().optional(),
  maxAge: z.number().int().min(0).max(120).nullable().optional(),
});

// POST /api/tasks/create — a granted user creates a task, funding its reward pool
// from their wallet. Lands as PENDING_REVIEW for admin approval before serving.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Admin master switch comes first: turning buyer funding off has to close the
  // API even for accounts that already hold the `createTasks` feature.
  const buyer = await getBuyerSettings();
  if (!buyer.enabled) {
    return NextResponse.json(
      { error: "Buyer task creation is currently turned off." },
      { status: 403 }
    );
  }
  if (!(await userCanFeature(userId, "createTasks"))) {
    return NextResponse.json(
      { error: "Task creation isn't enabled for your account." },
      { status: 403 }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  if (!buyer.allowedTaskTypes.includes(d.type)) {
    return NextResponse.json(
      {
        error: buyer.allowedTaskTypes.length
          ? `Buyers can currently create ${buyer.allowedTaskTypes.join(" and ")} tasks only.`
          : "No task type is open to buyers right now.",
      },
      { status: 403 }
    );
  }

  if (d.pointsReward < buyer.minPointsPerTask) {
    return NextResponse.json(
      { error: `The reward must be at least ${buyer.minPointsPerTask} points per completion.` },
      { status: 400 }
    );
  }
  if (d.pointsReward > buyer.maxPointsPerTask) {
    return NextResponse.json(
      { error: `The reward can be at most ${buyer.maxPointsPerTask} points per completion.` },
      { status: 400 }
    );
  }
  if (d.targetCount > buyer.maxCompletions) {
    return NextResponse.json(
      { error: `One task can be funded for at most ${buyer.maxCompletions} completions.` },
      { status: 400 }
    );
  }

  // KYC gate. Checked here rather than at payout because the buyer is about to
  // put money in — an unverified account should be stopped before it spends,
  // not after.
  if (buyer.requireKyc) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    });
    if (me?.kycStatus !== KYCStatus.APPROVED) {
      return NextResponse.json(
        { error: "Complete KYC verification before funding a task." },
        { status: 403 }
      );
    }
  }

  if (d.type === "SOCIAL" && (!d.socialUrl || !d.socialAction)) {
    return NextResponse.json(
      { error: "Social tasks need a target URL and an action." },
      { status: 400 }
    );
  }

  // Per-type gate: SOCIAL self-serve additionally requires the socialTasks
  // feature (an admin can enable task creation but disable social specifically).
  if (d.type === "SOCIAL" && !(await userCanFeature(userId, "socialTasks"))) {
    return NextResponse.json(
      { error: "Social task creation isn't enabled for your account." },
      { status: 403 }
    );
  }

  // Audience targeting is a granted capability — strip it otherwise.
  const audience = (await userCanFeature(userId, "targetTasks"))
    ? sanitizeTaskAudience(d)
    : EMPTY_TASK_AUDIENCE;

  // One quote, used for the charge, the invoice line and the ledger rows. The
  // buyer-facing calculator calls the same `quoteTask`, so what they were shown
  // and what they are charged cannot drift apart.
  const pointsPerUsd = await getPointsPerUsd();
  const quote = quoteTask({
    pointsPerCompletion: d.pointsReward,
    completions: d.targetCount,
    pointsPerUsd,
    feePercent: buyer.feePercent,
  });
  const budgetPoints = quote.budgetPoints;

  try {
    const task = await prisma.$transaction(async (tx) => {
      // Funded from TASK CREDIT, never from the wallet or from earned points.
      // Task credit is bought with cash on /buy-points and can only ever be
      // spent here; keeping the two apart is what stops "buy points, get them
      // rejected, withdraw the refund" being a way to move money through the
      // platform. CAS, so two concurrent creates cannot spend the same points.
      const paid = await spendTaskCredit(tx, userId, quote.totalPoints);
      if (!paid) throw new Error("INSUFFICIENT_CREDIT");

      const created = await tx.task.create({
        data: {
          title: d.title,
          description: d.description,
          instructions: d.instructions || null,
          type: d.type as TaskType,
          // Admins can waive the review queue entirely for buyer tasks.
          status: buyer.autoApproveTasks ? "ACTIVE" : "PENDING_REVIEW",
          pointsReward: d.pointsReward,
          xpReward: 0,
          totalLimit: d.targetCount,
          minLevel: d.minLevel,
          ...audience,
          autoApprove: false,
          createdById: userId,
          fundedByUserId: userId,
          budgetPoints,
          remainingBudget: budgetPoints,
          socialPlatform: d.type === "SOCIAL" ? d.socialPlatform || null : null,
          socialAction: d.type === "SOCIAL" ? d.socialAction || null : null,
          socialUrl: d.type === "SOCIAL" ? d.socialUrl || null : null,
        },
      });

      // The reward pool and the platform fee are separate rows on purpose. A
      // single combined charge makes the fee invisible in /admin/finance, and
      // the fee is the platform's revenue on this transaction — the reason the
      // buyer system exists at all.
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.PURCHASE,
          status: TransactionStatus.COMPLETED,
          // No cash moved — this records credit being committed to a task.
          // `amount` carries the USD value for reporting; the real movement is
          // in `points`.
          amount: 0,
          points: -budgetPoints,
          description: `Task budget — "${created.title}"`,
          reference: `task_fund_${created.id}`,
          metadata: {
            taskId: created.id,
            kind: "task_fund",
            budgetPoints,
            feePoints: quote.feePoints,
            rewardUsd: quote.rewardUsd,
            feePercent: quote.feePercent,
          },
        },
      });
      if (quote.feePoints > 0) {
        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.ADMIN_FEE,
            status: TransactionStatus.COMPLETED,
            // The fee IS revenue, so it keeps its USD value: those points were
            // bought with real cash and the platform now owns them.
            amount: -quote.feeUsd,
            points: -quote.feePoints,
            description: `Platform fee (${quote.feePercent}%) — "${created.title}"`,
            reference: `task_fee_${created.id}`,
            metadata: {
              taskId: created.id,
              kind: "task_fee",
              feePercent: quote.feePercent,
              feePoints: quote.feePoints,
            },
          },
        });
      }
      return created;
    });

    return NextResponse.json(
      {
        success: true,
        id: task.id,
        pending: !buyer.autoApproveTasks,
        invoice: quote,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_CREDIT") {
      const have = await getTaskCredit(userId);
      return NextResponse.json(
        {
          error:
            quote.feePoints > 0
              ? `Not enough task credit. This task needs ${quote.budgetPoints.toLocaleString()} points for ${d.targetCount} completions plus a ${quote.feePoints.toLocaleString()}-point platform fee — ${quote.totalPoints.toLocaleString()} in total, and you have ${have.toLocaleString()}.`
              : `Not enough task credit. This task needs ${quote.totalPoints.toLocaleString()} points and you have ${have.toLocaleString()}.`,
          shortByPoints: Math.max(0, quote.totalPoints - have),
          buyPointsHref: "/buy-points",
        },
        { status: 402 }
      );
    }
    console.error("Task create failed:", e);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
