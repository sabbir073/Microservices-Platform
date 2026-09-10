import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { getBuyerSettings } from "@/lib/buyer-settings";
import { refundTaskCredit } from "@/lib/task-credit";
import { toNum } from "@/lib/money";
import { TransactionType, TransactionStatus, NotificationType } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/tasks/[id]/review — approve or reject a user-submitted
// (PENDING_REVIEW) task. Rejecting refunds the creator's remaining budget.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user || !(await can(session.user.id, "tasks.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : "approve";
  const reason = String(body.reason ?? "").trim().slice(0, 500);

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      fundedByUserId: true,
      remainingBudget: true,
    },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "This task is not awaiting review." },
      { status: 400 }
    );
  }

  // A rejection without a reason is one the buyer cannot act on: they paid for
  // this, and "rejected" alone tells them nothing to change. Required on the
  // server too, so it holds for any caller, not just the admin UI.
  if (action === "reject" && reason.length < 5) {
    return NextResponse.json(
      { error: "Give the buyer a reason — they see it in their Buyer Hub." },
      { status: 400 }
    );
  }

  if (action === "approve") {
    // The admin may narrow who sees a buyer's task to a plan tier as they
    // approve it. Deliberately admin-only: the buyer's create endpoint does not
    // accept `requiredAccessLevel` at all, so a buyer can neither restrict
    // their task to premium members nor widen it past what was approved.
    const rawLevel = Number(body.requiredAccessLevel);
    const requiredAccessLevel = Number.isFinite(rawLevel)
      ? Math.max(0, Math.min(100, Math.floor(rawLevel)))
      : null;

    await prisma.task.update({
      where: { id },
      data: {
        status: "ACTIVE",
        ...(requiredAccessLevel === null ? {} : { requiredAccessLevel }),
      },
    });
    if (task.fundedByUserId) {
      await notifyUser({
        userId: task.fundedByUserId,
        type: NotificationType.SYSTEM,
        title: "Task approved ✅",
        message: `Your task "${task.title}" is approved and now live.`,
        link: "/buyer",
      }).catch(() => {});
    }
    await writeAudit({
      actorId: session.user.id,
      action: "TASK_REVIEWED",
      entity: "Task",
      entityId: id,
      targetUserId: task.fundedByUserId ?? null,
      summary: `Approved "${task.title}" — now live${
        requiredAccessLevel ? ` (plans at level ${requiredAccessLevel}+)` : ""
      }`,
      meta: {
        decision: "approve",
        title: task.title,
        requiredAccessLevel,
      },
    });
    return NextResponse.json({ success: true, status: "ACTIVE" });
  }

  // Reject -> return the unspent budget to the buyer's TASK CREDIT.
  //
  // Not to their cash. Refunding to `cashBalance` would make "buy credit, fund
  // a task, get it rejected" a way to turn task credit back into withdrawable
  // money, which is the exact hole the separate balance exists to close. It
  // goes back where it came from.
  const budgetRefundPoints =
    task.fundedByUserId && task.remainingBudget > 0 ? task.remainingBudget : 0;

  // ...and the platform fee they paid to submit it, unless the admin has
  // chosen to keep it as a review charge. Charging a buyer a commission for a
  // task you then refuse is the fastest way to lose the buyer, so the setting
  // defaults to refunding. The fee comes off its own ledger row rather than
  // being recomputed from the current fee percent — the rate may have changed
  // since they paid, and they are owed what they actually paid.
  const buyer = await getBuyerSettings();
  let feeRefundPoints = 0;
  let feeRefundUsd = 0;
  if (task.fundedByUserId && buyer.refundFeeOnReject) {
    const feeRow = await prisma.transaction.findFirst({
      where: {
        userId: task.fundedByUserId,
        reference: `task_fee_${task.id}`,
      },
      select: { amount: true, points: true },
    });
    // Both were written as negative charges on the payer.
    feeRefundPoints = feeRow ? Math.abs(feeRow.points ?? 0) : 0;
    feeRefundUsd = feeRow ? Math.abs(toNum(feeRow.amount)) : 0;
  }
  const refundPoints = budgetRefundPoints + feeRefundPoints;

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id },
      data: { status: "REJECTED", remainingBudget: 0, rejectionReason: reason },
    });
    if (task.fundedByUserId && refundPoints > 0) {
      await refundTaskCredit(tx, task.fundedByUserId, refundPoints, {
        taskId: task.id,
        kind: "task_refund",
      });
      // Reverse the revenue row as well, so the finance console does not keep
      // reporting a fee the platform gave back as income. This one carries the
      // USD value: the fee WAS booked as revenue in dollars.
      if (feeRefundUsd > 0) {
        await tx.transaction.create({
          data: {
            userId: task.fundedByUserId,
            type: TransactionType.ADMIN_FEE,
            status: TransactionStatus.COMPLETED,
            amount: feeRefundUsd,
            points: feeRefundPoints,
            description: `Platform fee refunded — "${task.title}"`,
            reference: `task_fee_refund_${task.id}`,
            metadata: {
              taskId: task.id,
              kind: "task_fee_refund",
              feeRefundPoints,
            },
          },
        });
      }
    }
  });

  if (task.fundedByUserId) {
    await notifyUser({
      userId: task.fundedByUserId,
      type: NotificationType.SYSTEM,
      title: "Task rejected",
      message: `Your task "${task.title}" was rejected${reason ? `: ${reason}` : ""}. ${refundPoints.toLocaleString()} task credit points were returned${feeRefundPoints > 0 ? " (budget + platform fee)" : ""}.`,
      link: "/buyer",
    }).catch(() => {});
  }
  await writeAudit({
    actorId: session.user.id,
    action: "TASK_REVIEWED",
    entity: "Task",
    entityId: id,
    targetUserId: task.fundedByUserId ?? null,
    summary: `Rejected "${task.title}"${reason ? ` — ${reason}` : ""} · returned ${refundPoints.toLocaleString()} task credit`,
    meta: {
      decision: "reject",
      reason: reason ?? null,
      refundPoints,
      feeRefundPoints,
      title: task.title,
    },
  });
  return NextResponse.json({ success: true, status: "REJECTED", refundPoints });
}
